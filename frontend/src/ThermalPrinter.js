/**
 * Thermal Bluetooth Printer Service
 * Supports ESC/POS thermal printers via Web Bluetooth API
 */

class ThermalPrinter {
  constructor() {
    this.device = null
    this.characteristic = null
    this.connected = false
  }

  async connect() {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth tidak didukung di browser ini. Gunakan Chrome/Edge.')
    }

    this.device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
        { services: ['e7810a71-73ae-11d0-a24c-00c04f12e4e6'] },
      ],
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-11d0-a24c-00c04f12e4e6',
        '0000ffe0-0000-1000-8000-00805f9b34fb',
        '0000fee7-0000-1000-8000-00805f9b34fb',
      ],
    })

    const server = await this.device.gatt.connect()

    // Try multiple known printer service UUIDs
    let service = null
    const serviceUUIDs = [
      '000018f0-0000-1000-8000-00805f9b34fb',
      'e7810a71-73ae-11d0-a24c-00c04f12e4e6',
      '0000ffe0-0000-1000-8000-00805f9b34fb',
      '0000fee7-0000-1000-8000-00805f9b34fb',
    ]

    for (const uuid of serviceUUIDs) {
      try {
        service = await server.getPrimaryService(uuid)
        if (service) break
      } catch (e) {
        continue
      }
    }

    if (!service) {
      throw new Error('Tidak menemukan service printer yang kompatibel')
    }

    // Try to get write characteristic
    const writeUUIDs = [
      '00002af1-0000-1000-8000-00805f9b34fb',
      '0000ffe1-0000-1000-8000-00805f9b34fb',
      '0000fee9-0000-1000-8000-00805f9b34fb',
    ]

    for (const uuid of writeUUIDs) {
      try {
        this.characteristic = await service.getCharacteristic(uuid)
        if (this.characteristic) break
      } catch (e) {
        continue
      }
    }

    if (!this.characteristic) {
      // Fallback: get any characteristic that supports write
      const chars = await service.getCharacteristics()
      for (const char of chars) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          this.characteristic = char
          break
        }
      }
    }

    if (!this.characteristic) {
      throw new Error('Tidak menemukan karakteristik write untuk printer')
    }

    this.connected = true
    return true
  }

  disconnect() {
    if (this.device && this.device.gatt.connected) {
      this.device.gatt.disconnect()
    }
    this.connected = false
    this.device = null
    this.characteristic = null
  }

  async send(data) {
    if (!this.characteristic) throw new Error('Printer tidak terhubung')

    const chunkSize = 200
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize)
      try {
        await this.characteristic.writeValueWithoutResponse(chunk)
      } catch (e) {
        await this.characteristic.writeValue(chunk)
      }
      // Jeda antar chunk supaya printer tidak overload
      await new Promise((r) => setTimeout(r, 20))
    }
    // Tunggu sebentar supaya printer selesai proses sebelum disconnect
    await new Promise((r) => setTimeout(r, 500))
  }

  // ESC/POS Commands
  static ESC = 0x1b
  static GS = 0x1d

  static init() {
    return new Uint8Array([0x1b, 0x40]) // ESC @
  }

  static feed(lines = 3) {
    return new Uint8Array([0x1b, 0x64, lines])
  }

  static cut() {
    return new Uint8Array([0x1d, 0x56, 0x00]) // Full cut
  }

  static partialCut() {
    return new Uint8Array([0x1d, 0x56, 0x01])
  }

  static bold(on = true) {
    return new Uint8Array([0x1b, 0x45, on ? 0x01 : 0x00])
  }

  static underline(mode = 0) {
    return new Uint8Array([0x1b, 0x2d, mode])
  }

  static align(position = 'left') {
    const pos = { left: 0, center: 1, right: 2 }
    return new Uint8Array([0x1b, 0x61, pos[position] || 0])
  }

  static setSize(width = 1, height = 1) {
    return new Uint8Array([0x1d, 0x21, (height << 4) | width])
  }

  static doubleHeight(on = true) {
    if (on) {
      return new Uint8Array([0x1b, 0x21, 0x10])
    }
    return new Uint8Array([0x1b, 0x21, 0x00])
  }

  static resetStyle() {
    return new Uint8Array([0x1b, 0x21, 0x00, 0x1b, 0x45, 0x00, 0x1b, 0x2d, 0x00])
  }

  static encodeText(text) {
    const encoder = new TextEncoder()
    return encoder.encode(text)
  }

  static centerText(text, width = 32) {
    const pad = Math.max(0, Math.floor((width - text.length) / 2))
    return ' '.repeat(pad) + text
  }

  static rightText(text, width = 32) {
    const pad = Math.max(0, width - text.length)
    return ' '.repeat(pad) + text
  }

  static lineText(left, right, width = 32) {
    const gap = Math.max(1, width - left.length - right.length)
    return left + ' '.repeat(gap) + right
  }

  static separatorLine(char = '-', width = 32) {
    return char.repeat(width)
  }
}

/**
 * Build ESC/POS receipt bytes from receipt data
 */
export function buildReceiptData(receipt, storeSettings = {}) {
  const cmds = []

  const storeName = storeSettings.store_name || 'KopiKita Cafe'
  const storeAddress = storeSettings.store_address || 'Jl. Merdeka No. 88, Bandung'
  const storePhone = storeSettings.store_phone || '08123456789'
  const footer = storeSettings.receipt_footer || 'Terima kasih atas kunjungan Anda!'
  const lineWidth = 32

  // Init & reset
  cmds.push(ThermalPrinter.init())
  cmds.push(ThermalPrinter.resetStyle())

  // --- Nama Toko (tebal + besar) ---
  cmds.push(ThermalPrinter.align('center'))
  cmds.push(ThermalPrinter.bold(true))
  cmds.push(ThermalPrinter.setSize(2, 2))
  cmds.push(ThermalPrinter.encodeText(storeName))
  cmds.push(ThermalPrinter.setSize(1, 1))
  cmds.push(ThermalPrinter.bold(false))

  // Alamat & telepon
  cmds.push(ThermalPrinter.encodeText(storeAddress))
  cmds.push(ThermalPrinter.encodeText(storePhone))

  // Garis pemisah
  cmds.push(ThermalPrinter.encodeText('================================'))

  // Info order
  cmds.push(ThermalPrinter.align('left'))
  cmds.push(ThermalPrinter.bold(true))
  cmds.push(ThermalPrinter.encodeText('No   : ' + (receipt.receipt_no || '')))
  cmds.push(ThermalPrinter.encodeText('Tgl  : ' + (receipt.date ? new Date(receipt.date).toLocaleString('id-ID') : '')))
  cmds.push(ThermalPrinter.encodeText('Kasir: ' + (receipt.cashier || '')))
  if (receipt.table) {
    cmds.push(ThermalPrinter.encodeText('Meja : ' + String(receipt.table)))
  }
  cmds.push(ThermalPrinter.bold(false))
  cmds.push(ThermalPrinter.encodeText('--------------------------------'))

  // --- Items ---
  for (const item of (receipt.items || [])) {
    const name = item.qty + 'x ' + item.name
    const price = formatIDR(item.subtotal)
    cmds.push(ThermalPrinter.bold(false))
    cmds.push(ThermalPrinter.encodeText(ThermalPrinter.lineText(name, price, lineWidth)))
    cmds.push(ThermalPrinter.encodeText('  @ ' + formatIDR(item.price)))
  }
  cmds.push(ThermalPrinter.encodeText('--------------------------------'))

  // --- Total ---
  cmds.push(ThermalPrinter.encodeText(ThermalPrinter.lineText('Subtotal:', formatIDR(receipt.subtotal), lineWidth)))
  if (receipt.discount > 0) {
    cmds.push(ThermalPrinter.encodeText(ThermalPrinter.lineText('Diskon:', '-' + formatIDR(receipt.discount), lineWidth)))
  }
  cmds.push(ThermalPrinter.encodeText(ThermalPrinter.lineText('PPN 11%:', formatIDR(receipt.tax), lineWidth)))
  cmds.push(ThermalPrinter.encodeText('================================'))
  cmds.push(ThermalPrinter.bold(true))
  cmds.push(ThermalPrinter.setSize(2, 1))
  cmds.push(ThermalPrinter.encodeText(ThermalPrinter.lineText('TOTAL:', formatIDR(receipt.total), lineWidth)))
  cmds.push(ThermalPrinter.setSize(1, 1))
  cmds.push(ThermalPrinter.bold(false))
  cmds.push(ThermalPrinter.encodeText('================================'))

  // --- Pembayaran ---
  cmds.push(ThermalPrinter.bold(false))
  cmds.push(ThermalPrinter.encodeText(ThermalPrinter.lineText('Bayar:', formatIDR(receipt.payment_amount), lineWidth)))
  cmds.push(ThermalPrinter.encodeText('(' + (receipt.payment_method || '').toUpperCase() + ')'))
  if (receipt.change > 0) {
    cmds.push(ThermalPrinter.bold(true))
    cmds.push(ThermalPrinter.encodeText(ThermalPrinter.lineText('Kembali:', formatIDR(receipt.change), lineWidth)))
    cmds.push(ThermalPrinter.bold(false))
  }

  // --- Footer & Potong ---
  cmds.push(ThermalPrinter.align('center'))
  cmds.push(ThermalPrinter.bold(true))
  cmds.push(ThermalPrinter.encodeText(footer))
  cmds.push(ThermalPrinter.bold(false))
  cmds.push(ThermalPrinter.feed(1))
  cmds.push(ThermalPrinter.cut())
  // Reset printer setelah potong - hentikan semua aktivitas
  cmds.push(ThermalPrinter.init())

  // Flatten
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

export default ThermalPrinter