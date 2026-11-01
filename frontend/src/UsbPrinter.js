/**
 * Thermal USB Printer Service
 * Supports ESC/POS thermal printers via WebUSB API
 *
 * Printer yang support (umumnya semua printer thermal ESC/POS):
 * - Epson TM-T20, TM-T81, TM-T82, TM-T88, TM-m30, TM-m50
 * - Xprinter XP-80C, XP-80III, XP-N160II, XP-T2000
 * - Gainscha GP-80250, GP-L80250
 * - Bixolon SRP-350, SRP-380, SPP-R200
 * - Citizen CT-S310, CT-S4000
 * - Star TSP143, TSP654, TSP743
 * - Anyprinter/Generic ESC/POS thermal printer 58mm/80mm
 *
 * Catatan:
 * - Hanya bisa di Chrome/Edge (WebUSB tidak didukung Firefox/Safari)
 * - Saat pertama kali, browser akan meminta izin pilih device USB
 * - Printer harus dalam mode ESC/POS (bukan mode Windows Generic Text)
 * - Pastikan driver EPSON OPOS atau EPSON Advanced Printer Driver sudah terinstall
 */

class UsbPrinter {
  constructor() {
    this.device = null
    this.endpointOut = null
    this.endpointIn = null
    this.connected = false
  }

  async connect() {
    if (!navigator.usb) {
      throw new Error('WebUSB tidak didukung di browser ini. Gunakan Chrome/Edge.')
    }

    // Request any printer device — user akan pilih dari list
    this.device = await navigator.usb.requestDevice({ filters: [] })

    await this.device.open()

    // Cari interface yang punya endpoint bulk out (untuk kirim data)
    if (this.device.configuration === null) {
      await this.device.selectConfiguration(1)
    }

    const config = this.device.configurations[0]
    for (const iface of config.interfaces) {
      const alternate = iface.alternates[0]
      if (!alternate) continue

      // Cari endpoint OUT (bulk atau interrupt)
      for (const endpoint of alternate.endpoints) {
        if (endpoint.direction === 'out') {
          this.endpointOut = endpoint
        }
        if (endpoint.direction === 'in') {
          this.endpointIn = endpoint
        }
      }

      // Jika ketemu endpoint OUT, claim interface ini
      if (this.endpointOut) {
        try {
          await this.device.claimInterface(iface.interfaceNumber)
        } catch {
          // Mungkin sudah di-claim, coba lanjut
        }
        this.interfaceNumber = iface.interfaceNumber
        break
      }
    }

    if (!this.endpointOut) {
      await this.device.close()
      throw new Error('Tidak menemukan endpoint print pada device USB ini')
    }

    this.connected = true
    return true
  }

  disconnect() {
    if (this.device) {
      try {
        if (this.interfaceNumber !== undefined) {
          this.device.releaseInterface(this.interfaceNumber)
        }
        this.device.close()
      } catch {}
    }
    this.device = null
    this.endpointOut = null
    this.endpointIn = null
    this.connected = false
  }

  async send(data) {
    if (!this.endpointOut || !this.device) throw new Error('Printer USB tidak terhubung')

    const chunkSize = 64 // USB bulk transfer typical chunk size
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize)
      await this.device.transferOut(this.endpointOut.endpointNumber, chunk)
      // Jeda antar chunk supaya printer tidak overload
      await new Promise((r) => setTimeout(r, 10))
    }
    // Tunggu sebentar supaya printer selesai proses
    await new Promise((r) => setTimeout(r, 500))
  }

  // Sama seperti ThermalPrinter — ESC/POS commands
  static ESC = 0x1b
  static GS = 0x1d

  static init() { return new Uint8Array([0x1b, 0x40]) }
  static feed(lines = 3) { return new Uint8Array([0x1b, 0x64, lines]) }
  static cut() { return new Uint8Array([0x1d, 0x56, 0x00]) }
  static bold(on = true) { return new Uint8Array([0x1b, 0x45, on ? 0x01 : 0x00]) }
  static underline(mode = 0) { return new Uint8Array([0x1b, 0x2d, mode]) }
  static align(position = 'left') {
    const pos = { left: 0, center: 1, right: 2 }
    return new Uint8Array([0x1b, 0x61, pos[position] || 0])
  }
  static setSize(width = 1, height = 1) { return new Uint8Array([0x1d, 0x21, (height << 4) | width]) }
  static resetStyle() { return new Uint8Array([0x1b, 0x21, 0x00, 0x1b, 0x45, 0x00, 0x1b, 0x2d, 0x00]) }
  static encodeText(text) { return new TextEncoder().encode(text) }
  static lineText(left, right, width = 32) {
    const gap = Math.max(1, width - left.length - right.length)
    return left + ' '.repeat(gap) + right
  }
}

/**
 * Build ESC/POS receipt bytes dari receipt data (sama dengan ThermalPrinter.buildReceiptData)
 */
export function buildUsbReceiptData(receipt, storeSettings = {}) {
  const cmds = []

  const storeName = storeSettings.store_name || 'Sotoyuk'
  const storeAddress = storeSettings.store_address || 'Jl. Merdeka No. 88, Bandung'
  const storePhone = storeSettings.store_phone || '08123456789'
  const footer = storeSettings.receipt_footer || 'Terima kasih atas kunjungan Anda!'
  const lineWidth = 32

  cmds.push(UsbPrinter.init())
  cmds.push(UsbPrinter.resetStyle())

  // Nama Toko
  cmds.push(UsbPrinter.align('center'))
  cmds.push(UsbPrinter.bold(true))
  cmds.push(UsbPrinter.setSize(2, 2))
  cmds.push(UsbPrinter.encodeText(storeName))
  cmds.push(UsbPrinter.setSize(1, 1))
  cmds.push(UsbPrinter.bold(false))

  cmds.push(UsbPrinter.encodeText(storeAddress))
  cmds.push(UsbPrinter.encodeText(storePhone))
  cmds.push(UsbPrinter.encodeText('================================'))

  // Info order
  cmds.push(UsbPrinter.align('left'))
  cmds.push(UsbPrinter.bold(true))
  cmds.push(UsbPrinter.encodeText('No   : ' + (receipt.receipt_no || '')))
  cmds.push(UsbPrinter.encodeText('Tgl  : ' + (receipt.date ? new Date(receipt.date).toLocaleString('id-ID') : '')))
  cmds.push(UsbPrinter.encodeText('Kasir: ' + (receipt.cashier || '')))
  cmds.push(UsbPrinter.bold(false))
  cmds.push(UsbPrinter.encodeText('--------------------------------'))

  // Items
  for (const item of (receipt.items || [])) {
    const name = item.qty + 'x ' + item.name
    const price = formatIDR(item.subtotal)
    cmds.push(UsbPrinter.encodeText(UsbPrinter.lineText(name, price, lineWidth)))
    cmds.push(UsbPrinter.encodeText('  @ ' + formatIDR(item.price)))
  }
  cmds.push(UsbPrinter.encodeText('--------------------------------'))

  // Total
  cmds.push(UsbPrinter.encodeText(UsbPrinter.lineText('Subtotal:', formatIDR(receipt.subtotal), lineWidth)))
  if (receipt.discount > 0) {
    cmds.push(UsbPrinter.encodeText(UsbPrinter.lineText('Diskon:', '-' + formatIDR(receipt.discount), lineWidth)))
  }
  cmds.push(UsbPrinter.encodeText('================================'))
  cmds.push(UsbPrinter.bold(true))
  cmds.push(UsbPrinter.setSize(2, 1))
  cmds.push(UsbPrinter.encodeText(UsbPrinter.lineText('TOTAL:', formatIDR(receipt.total), lineWidth)))
  cmds.push(UsbPrinter.setSize(1, 1))
  cmds.push(UsbPrinter.bold(false))
  cmds.push(UsbPrinter.encodeText('================================'))

  // Pembayaran
  cmds.push(UsbPrinter.encodeText(UsbPrinter.lineText('Bayar:', formatIDR(receipt.payment_amount), lineWidth)))
  cmds.push(UsbPrinter.encodeText('(' + (receipt.payment_method || '').toUpperCase() + ')'))
  if (receipt.change > 0) {
    cmds.push(UsbPrinter.bold(true))
    cmds.push(UsbPrinter.encodeText(UsbPrinter.lineText('Kembali:', formatIDR(receipt.change), lineWidth)))
    cmds.push(UsbPrinter.bold(false))
  }

  // Footer
  cmds.push(UsbPrinter.align('center'))
  cmds.push(UsbPrinter.bold(true))
  cmds.push(UsbPrinter.encodeText(footer))
  cmds.push(UsbPrinter.bold(false))
  cmds.push(UsbPrinter.feed(1))
  cmds.push(UsbPrinter.cut())
  cmds.push(UsbPrinter.init())

  const totalLen = cmds.reduce((s, c) => s + c.length, 0)
  const result = new Uint8Array(totalLen)
  let offset = 0
  for (const cmd of cmds) {
    result.set(cmd, offset)
    offset += cmd.length
  }
  return result
}

function formatIDR(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n || 0)
}

export default UsbPrinter
