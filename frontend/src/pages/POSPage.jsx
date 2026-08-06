import { useState, useEffect } from 'react'
import { productAPI, categoryAPI, orderAPI, paymentAPI, settingAPI, membershipAPI, tableAPI } from '../api'
import { useAuth } from '../AuthContext'
import { buildReceiptData } from '../ThermalPrinter'
import {
  Plus, Minus, Trash2, ShoppingCart, X, Search, CreditCard,
  Banknote, QrCode, Receipt, CheckCircle, Printer, Package, Bluetooth,
} from 'lucide-react'

const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

export default function POSPage() {
  const { user } = useAuth()
  const isKasir = user?.role === 'kasir'
  const isAdmin = user?.role === 'admin'
  const isSuperadmin = user?.role === 'superadmin'
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [selectedCat, setSelectedCat] = useState(null)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [showPay, setShowPay] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [lastPayment, setLastPayment] = useState(null)
  const [paying, setPaying] = useState(false)
  const [method, setMethod] = useState('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [btPrinting, setBtPrinting] = useState(false)
  const [btPrinter, setBtPrinter] = useState(null)
  const [btStatus, setBtStatus] = useState('')
  const [storeSettings, setStoreSettings] = useState({})
  const [members, setMembers] = useState([])
  const [selectedMember, setSelectedMember] = useState(null)
  const [redeemPoints, setRedeemPoints] = useState('')
  const [tables, setTables] = useState([])
  const [selectedTable, setSelectedTable] = useState(null)

  useEffect(() => {
    categoryAPI.list().then((r) => setCategories(r.data))
    loadProducts()
    loadTables()
    settingAPI.list().then((r) => {
      const s = {}
      r.data.forEach((item) => { s[item.key] = item.value || '' })
      setStoreSettings(s)
    })
    membershipAPI.members.list().then((r) => setMembers(r.data))

    // Refresh table status periodically so multiple cashiers see live status
    const interval = setInterval(() => {
      loadTables()
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadTables = async () => {
    const r = await tableAPI.list()
    setTables(r.data)
  }

  const handleClearTable = async (id) => {
    if (!confirm('Tandai meja siap dipakai kembali?')) return
    try {
      await tableAPI.updateStatus(id, 'available')
      loadTables()
      if (selectedTable?.id === id) setSelectedTable(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Gagal membuka meja')
    }
  }

  const handleReserveTable = async (id) => {
    if (!confirm('Kunci meja untuk reservasi?')) return
    try {
      await tableAPI.updateStatus(id, 'reserved')
      loadTables()
      if (selectedTable?.id === id) setSelectedTable(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Gagal reservasi meja')
    }
  }

  const loadProducts = async (catId = null, q = '') => {
    const params = {}
    if (catId) params.category_id = catId
    if (q) params.search = q
    const r = await productAPI.list(params)
    setProducts(r.data)
  }

  const selectCategory = (id) => {
    setSelectedCat(id === selectedCat ? null : id)
    loadProducts(id === selectedCat ? null : id, search)
  }

  const handleSearch = (e) => {
    setSearch(e.target.value)
    loadProducts(selectedCat, e.target.value)
  }

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id)
      if (existing) {
        if (existing.qty >= product.stock) return prev
        return prev.map((i) =>
          i.product_id === product.id
            ? { ...i, qty: i.qty + 1, subtotal: (i.qty + 1) * i.price }
            : i
        )
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          price: product.price,
          qty: 1,
          subtotal: product.price,
          stock: product.stock,
        },
      ]
    })
  }

  const updateQty = (pid, delta) => {
    setCart((prev) => {
      return prev
        .map((i) => {
          if (i.product_id !== pid) return i
          const newQty = i.qty + delta
          if (newQty <= 0) return null
          if (newQty > i.stock) return i
          return { ...i, qty: newQty, subtotal: newQty * i.price }
        })
        .filter(Boolean)
    })
  }

  const removeItem = (pid) => {
    setCart((prev) => prev.filter((i) => i.product_id !== pid))
  }

  const subtotal = cart.reduce((s, i) => s + i.subtotal, 0)
  const tax = Math.round(subtotal * 0.11)
  const total = subtotal + tax

  const handlePay = async () => {
    if (cart.length === 0) return
    setPaying(true)
    setError('')
    try {
       // Create order
       const orderRes = await orderAPI.create({
         table_id: selectedTable?.id || null,
         customer_id: selectedMember?.customer?.id || selectedMember?.customer_id || null,
         items: cart.map((i) => ({ product_id: i.product_id, qty: i.qty })),
         notes,
       })
       const order = orderRes.data
       // Refresh table status immediately after order created (table becomes occupied)
       loadTables()

       // Process payment
       const payAmount = method === 'cash' ? parseFloat(amountPaid) || total : total
      const payRes = await paymentAPI.pay({
        order_id: order.id,
        method,
        amount: payAmount,
        redeem_points: parseInt(redeemPoints) || 0,
      })
      setLastPayment(payRes.data)

       // Get receipt
       const receiptRes = await paymentAPI.receipt(order.id)
       setReceipt(receiptRes.data)
       setShowPay(false)
       setShowReceipt(true)
        setCart([])
        setAmountPaid('')
        setNotes('')
        setSelectedMember(null)
        setRedeemPoints('')
        setSelectedTable(null)
        // Reload products and tables to update stock & table status
        loadProducts(selectedCat, search)
        loadTables()
    } catch (err) {
      setError(err.response?.data?.detail || 'Pembayaran gagal')
    } finally {
      setPaying(false)
    }
  }

  const printReceipt = () => {
    if (!receipt) return
    // NOTE: Browser security prevents silent printing without the system print dialog.
    // This uses a hidden iframe so the user only sees the OS print dialog, not a popup window.
    const itemsHtml = (receipt.items || []).map(i => {
      let html = `<tr><td>${i.qty}x ${i.name}</td><td>${fmt(i.subtotal)}</td></tr>`
      html += `<tr><td style="padding-left:10px;color:#666">@ ${fmt(i.price)}</td><td></td></tr>`
      if (i.discount > 0) {
        html += `<tr><td style="padding-left:10px;color:#c00;font-size:11px">Diskon</td><td style="color:#c00;font-size:11px">-${fmt(i.discount * i.qty)}</td></tr>`
      }
      return html
    }).join('')
    const discountHtml = receipt.discount > 0 ? `<tr><td>Diskon:</td><td>-${fmt(receipt.discount)}</td></tr>` : ''
    const changeHtml = receipt.change > 0 ? `<tr><td class="bold">Kembali:</td><td class="bold">${fmt(receipt.change)}</td></tr>` : ''
    const tableLabel = receipt.table
      ? `Meja ${receipt.table.number || ''}${receipt.table.name ? ' - ' + receipt.table.name : ''}`
      : ''
    const tableHtml = tableLabel ? `<div class="bold">${tableLabel}</div>` : ''

    const html = `<!DOCTYPE html>
<html><head>
<title>Struk</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: monospace; font-size: 13px; padding: 10px; background: #fff; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .big { font-size: 18px; font-weight: bold; }
  .line { border-top: 1px dashed #000; margin: 6px 0; }
  .line2 { border-top: 2px solid #000; margin: 6px 0; }
  table { width: 100%; }
  td { padding: 2px 0; }
  td:last-child { text-align: right; }
  @media print { body { padding: 0; } @page { margin: 5mm; } }
</style></head><body>
<div class="center bold big">${storeSettings.store_name || 'KopiKita Cafe'}</div>
<div class="center">${storeSettings.store_address || 'Jl. Merdeka No. 88, Bandung'}</div>
<div class="center">${storeSettings.store_phone || '08123456789'}</div>
<div class="line2"></div>
<div class="bold">No   : ${receipt.receipt_no || ''}</div>
<div class="bold">Tgl  : ${receipt.date ? new Date(receipt.date).toLocaleString('id-ID') : ''}</div>
<div class="bold">Kasir: ${receipt.cashier || ''}</div>
${tableHtml}
<div class="line"></div>
<table>${itemsHtml}</table>
<div class="line"></div>
<table>
<tr><td>Subtotal:</td><td>${fmt(receipt.subtotal)}</td></tr>
${discountHtml}
<tr><td>PPN 11%:</td><td>${fmt(receipt.tax)}</td></tr>
</table>
<div class="line2"></div>
<table>
<tr><td class="bold" style="font-size:15px">TOTAL:</td><td class="bold" style="font-size:15px">${fmt(receipt.total)}</td></tr>
</table>
<div class="line2"></div>
<table>
<tr><td>Bayar (${(receipt.payment_method || '').toUpperCase()}):</td><td>${fmt(receipt.payment_amount)}</td></tr>
${changeHtml}
</table>
<div class="line"></div>
<div class="center bold">${storeSettings.receipt_footer || 'Terima kasih atas kunjungan Anda!'}</div>
<script>
  window.onload = function() { setTimeout(function() { window.print(); }, 300); };
</script>
</body></html>`

    let iframe = document.getElementById('receipt-print-frame')
    if (!iframe) {
      iframe = document.createElement('iframe')
      iframe.id = 'receipt-print-frame'
      iframe.style.position = 'fixed'
      iframe.style.bottom = '0'
      iframe.style.right = '0'
      iframe.style.width = '1px'
      iframe.style.height = '1px'
      iframe.style.opacity = '0'
      iframe.style.border = 'none'
      document.body.appendChild(iframe)
    }
    iframe.contentWindow.document.open()
    iframe.contentWindow.document.write(html)
    iframe.contentWindow.document.close()
  }

  const connectBtPrinter = async () => {
    try {
      setBtStatus('Menghubungkan...')
      const { default: ThermalPrinter } = await import('../ThermalPrinter')
      const printer = new ThermalPrinter()
      await printer.connect()
      setBtPrinter(printer)
      setBtStatus('Tersambung')
      setTimeout(() => setBtStatus(''), 2000)
    } catch (err) {
      setBtStatus(err.message || 'Gagal menghubungkan')
      setTimeout(() => setBtStatus(''), 4000)
    }
  }

  const disconnectBtPrinter = () => {
    if (btPrinter) {
      btPrinter.disconnect()
      setBtPrinter(null)
      setBtStatus('Terputus')
      setTimeout(() => setBtStatus(''), 2000)
    }
  }

  const printBtReceipt = async () => {
    if (!btPrinter || !receipt) return
    try {
      setBtPrinting(true)
      const { buildReceiptData } = await import('../ThermalPrinter')
      const data = buildReceiptData(receipt, storeSettings)
      await btPrinter.send(data)
      // Disconnect setelah cetak selesai supaya printer berhenti
      btPrinter.disconnect()
      setBtPrinter(null)
      setBtStatus('Berhasil cetak!')
      setTimeout(() => setBtStatus(''), 2000)
    } catch (err) {
      setBtStatus('Gagal cetak: ' + (err.message || ''))
      setTimeout(() => setBtStatus(''), 4000)
    } finally {
      setBtPrinting(false)
    }
  }

  const quickAmounts = [50000, 100000, 150000, 200000, 500000]

  return (
    <div className="flex gap-4 h-[calc(100vh-3rem)]">
      {/* Products */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tables */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-700">Pilih Meja</h3>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Kosong</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> Terisi</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500"></span> Reservasi</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500"></span> Bersihkan</span>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {tables.map((t) => {
              const color =
                t.status === 'occupied' ? 'bg-red-100 border-red-300 text-red-700' :
                t.status === 'reserved' ? 'bg-amber-100 border-amber-300 text-amber-700' :
                t.status === 'cleaning' ? 'bg-blue-100 border-blue-300 text-blue-700' :
                'bg-emerald-100 border-emerald-300 text-emerald-700'
              const selected = selectedTable?.id === t.id
              const locked = t.status === 'occupied' || t.status === 'reserved' || t.status === 'cleaning'
              return (
                <div
                  key={t.id}
                  className={`flex-shrink-0 min-w-[110px] px-2 py-2 rounded-xl border text-center transition-all ${color} ${selected ? 'ring-2 ring-offset-2 ring-amber-500' : ''}`}
                >
                  <div className="font-bold text-lg">#{t.number}</div>
                  <div className="text-xs truncate max-w-[110px] mb-1">{t.name || 'Meja'}</div>
                  <div className="text-[10px] font-medium uppercase tracking-wide opacity-80 mb-1">
                    {t.status === 'occupied' ? 'Terisi' : t.status === 'reserved' ? 'Reservasi' : t.status === 'cleaning' ? 'Bersihkan' : 'Kosong'}
                  </div>
                  {locked ? (
                    <button
                      onClick={() => handleClearTable(t.id)}
                      className="w-full text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-2 py-1 rounded-lg font-medium"
                    >
                      Buka Meja
                    </button>
                  ) : (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setSelectedTable(selected ? null : t)}
                        className={`flex-1 text-xs px-2 py-1 rounded-lg font-medium ${selected ? 'bg-amber-500 text-white' : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'}`}
                      >
                        {selected ? 'Dipilih' : 'Pilih'}
                      </button>
                      {(isAdmin || isSuperadmin) && (
                        <button
                          onClick={() => handleReserveTable(t.id)}
                          className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-200 px-2 py-1 rounded-lg font-medium"
                          title="Kunci reservasi"
                        >
                          Reservasi
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {tables.length === 0 && <div className="text-sm text-slate-500">Belum ada meja</div>}
          </div>
          {selectedTable && (
            <div className="mt-2 text-sm text-slate-700">
              Meja dipilih: <span className="font-semibold text-amber-600">#{selectedTable.number} {selectedTable.name ? ` - ${selectedTable.name}` : ''}</span>
              <button onClick={() => setSelectedTable(null)} className="ml-2 text-red-500 text-xs hover:underline">Hapus</button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
              placeholder="Cari produk..."
            />
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => selectCategory(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              !selectedCat
                ? 'bg-amber-500 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Semua
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => selectCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCat === cat.id
                  ? 'bg-amber-500 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.stock === 0}
                className="bg-white rounded-xl border border-slate-200 p-3 text-left hover:border-amber-400 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-full h-20 bg-slate-100 rounded-lg flex items-center justify-center mb-2 overflow-hidden">
                  {p.image ? (
                    <img
                      src={`${window.location.origin}${p.image}`}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none' }}
                    />
                  ) : (
                    <Package size={24} className="text-slate-400" />
                  )}
                </div>
                <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                <p className="text-xs text-slate-500">{p.sku}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm font-bold text-amber-600">{fmt(p.price)}</span>
                  <span className={`text-xs ${p.stock < 10 ? 'text-red-500' : 'text-slate-400'}`}>
                    Stok: {p.stock}
                  </span>
                </div>
              </button>
            ))}
          </div>
          {products.length === 0 && (
            <div className="text-center py-12 text-slate-500">Produk tidak ditemukan</div>
          )}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-96 bg-white rounded-xl border border-slate-200 flex flex-col shadow-sm">
        <div className="p-4 border-b border-slate-200 flex items-center gap-2">
          <ShoppingCart size={20} className="text-amber-500" />
          <h2 className="font-semibold text-slate-800">Keranjang</h2>
          <span className="ml-auto text-sm text-slate-500">{cart.length} item</span>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <ShoppingCart size={48} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Keranjang kosong</p>
            </div>
          )}
          {cart.map((item) => (
            <div key={item.product_id} className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                <p className="text-xs text-slate-500">{fmt(item.price)} / pcs</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateQty(item.product_id, -1)}
                  className="w-7 h-7 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center"
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center text-sm font-medium">{item.qty}</span>
                <button
                  onClick={() => updateQty(item.product_id, 1)}
                  className="w-7 h-7 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center"
                >
                  <Plus size={14} />
                </button>
              </div>
              <span className="text-sm font-medium w-24 text-right">{fmt(item.subtotal)}</span>
              <button
                onClick={() => removeItem(item.product_id)}
                className="text-red-400 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="px-4 pb-2">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-amber-500"
            placeholder="Catatan order (opsional)"
          />
        </div>

        {/* Totals */}
        <div className="p-4 border-t border-slate-200 space-y-2 bg-slate-50">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">PPN 11%</span>
            <span>{fmt(tax)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
            <span>Total</span>
            <span className="text-amber-600">{fmt(total)}</span>
          </div>
        </div>

        {/* Pay Button */}
        <div className="p-4">
          <button
            onClick={() => {
              setShowPay(true)
              setAmountPaid(String(total))
            }}
            disabled={cart.length === 0}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <CreditCard size={20} />
            Bayar
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {showPay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Pembayaran</h3>
              <button onClick={() => setShowPay(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 mb-4">
              <p className="text-sm text-slate-500">Total yang harus dibayar</p>
              <p className="text-3xl font-bold text-amber-600">{fmt(total)}</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
            )}

            {/* Payment Method */}
            <div className="mb-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Metode Bayar</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'cash', label: 'Tunai', icon: Banknote },
                  { key: 'qris', label: 'QRIS', icon: QrCode },
                  { key: 'debit', label: 'Debit', icon: CreditCard },
                  { key: 'credit', label: 'Kredit', icon: CreditCard },
                ].map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMethod(m.key)}
                    className={`p-3 rounded-xl border-2 text-sm font-medium flex flex-col items-center gap-1 transition-colors ${
                      method === m.key
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <m.icon size={20} />
                    {m.label}
                  </button>
                ))}
              </div>
                         </div>

            {/* Member / Points Redemption */}
            <div className="mb-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Member</p>
              <select
                value={selectedMember?.id || ''}
                onChange={(e) => {
                  const m = members.find((mm) => String(mm.id) === e.target.value)
                  setSelectedMember(m || null)
                  setRedeemPoints('')
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Pilih member (opsional)</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.member_code} - {m.customer?.name || '-'} ({m.points} poin)
                  </option>
                ))}
              </select>
              {selectedMember && (
                <div className="mt-2 flex items-end gap-3">
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 mb-1">Poin tersedia: <b className="text-amber-600">{selectedMember.points}</b></p>
                    <input
                      type="number"
                      min="0"
                      max={selectedMember.points}
                      value={redeemPoints}
                      onChange={(e) => setRedeemPoints(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="Poin redeem"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setRedeemPoints(Math.min(50, selectedMember.points).toString())}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium"
                  >
                    Pakai 50
                  </button>
                </div>
              )}
            </div>

            {/* Cash amount */}
            {method === 'cash' && (
              <div className="mb-4">
                <p className="text-sm font-medium text-slate-700 mb-2">Uang Diterima</p>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-2xl font-bold text-right outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="0"
                />
                <div className="flex gap-2 mt-2">
                  {quickAmounts
                    .filter((a) => a >= total)
                    .slice(0, 4)
                    .map((a) => (
                      <button
                        key={a}
                        onClick={() => setAmountPaid(String(a))}
                        className="flex-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-slate-700"
                      >
                        {fmt(a)}
                      </button>
                    ))}
                </div>
                {parseFloat(amountPaid) > 0 && (
                  <div className="mt-2 text-right">
                    <span className="text-sm text-slate-500">Kembalian: </span>
                    <span className="text-lg font-bold text-emerald-600">
                      {fmt(Math.max(0, parseFloat(amountPaid) - total))}
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handlePay}
              disabled={paying || (method === 'cash' && parseFloat(amountPaid) < total)}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {paying ? 'Memproses...' : 'Konfirmasi Pembayaran'}
            </button>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && receipt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[80vh] overflow-y-auto">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle size={32} className="text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Pembayaran Berhasil!</h3>
            </div>

            {/* Receipt content */}
            <div id="printable-receipt" className="bg-slate-50 rounded-xl p-4 font-mono text-xs space-y-2">
              <div className="text-center">
                <p className="font-bold text-sm">{storeSettings.store_name || 'KopiKita Cafe'}</p>
                <p className="text-slate-500">{storeSettings.store_address || 'Jl. Merdeka No. 88, Bandung'}</p>
                <p className="text-slate-500">Telp: {storeSettings.store_phone || '08123456789'}</p>
                <p className="border-b border-dashed border-slate-300 my-2"></p>
                <p className="text-slate-500">No: {receipt.receipt_no}</p>
                <p className="text-slate-500">
                  {new Date(receipt.date).toLocaleString('id-ID')}
                </p>
                {receipt.table && (
                  <p className="font-bold text-slate-700 mt-1">
                    Meja: #{receipt.table.number} {receipt.table.name ? `- ${receipt.table.name}` : ''}
                  </p>
                )}
              </div>
              <div className="border-b border-dashed border-slate-300 my-2"></div>
              <table className="w-full">
                <thead>
                  <tr className="text-slate-500">
                    <th className="text-left">Item</th>
                    <th className="text-center">Qty</th>
                    <th className="text-right">Harga</th>
                    <th className="text-right">Sub</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.items.map((item, idx) => (
                    <>
                      <tr key={idx}>
                        <td className="py-0.5">{item.name}</td>
                        <td className="text-center">{item.qty}</td>
                        <td className="text-right">{fmt(item.price)}</td>
                        <td className="text-right">{fmt(item.subtotal)}</td>
                      </tr>
                      {item.discount > 0 && (
                        <tr key={idx + '-disc'}>
                          <td className="text-red-500 text-[10px]">Diskon @{fmt(item.discount)}</td>
                          <td className="text-center"></td>
                          <td className="text-right"></td>
                          <td className="text-right text-red-500 text-[10px]">-{fmt(item.discount * item.qty)}</td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
              <div className="border-b border-dashed border-slate-300 my-2"></div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{fmt(receipt.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>PPN 11%</span>
                  <span>{fmt(receipt.tax)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm border-t pt-1">
                  <span>TOTAL</span>
                  <span>{fmt(receipt.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Bayar ({receipt.payment_method?.toUpperCase()})</span>
                  <span>{fmt(receipt.payment_amount)}</span>
                </div>
               {receipt.change > 0 && (
                 <div className="flex justify-between font-bold">
                   <span>Kembalian</span>
                   <span>{fmt(receipt.change)}</span>
                 </div>
               )}
               {lastPayment && (lastPayment.points_earned || lastPayment.points_used) && (
                 <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                   {lastPayment.points_used ? (
                     <div className="flex justify-between text-xs text-green-700">
                       <span>Poin redeem</span>
                       <span>-{lastPayment.points_used} poin</span>
                     </div>
                   ) : null}
                   {lastPayment.points_earned ? (
                     <div className="flex justify-between text-xs text-amber-700">
                       <span>Poin dapat</span>
                       <span>+{lastPayment.points_earned} poin</span>
                     </div>
                   ) : null}
                 </div>
               )}
               </div>
              <div className="border-b border-dashed border-slate-300 my-2"></div>
              <p className="text-center text-slate-500">{storeSettings.receipt_footer || 'Terima kasih atas kunjungan Anda!'}</p>
            </div>

            {/* Bluetooth printer status */}
            {btStatus && (
              <div className={`mt-3 text-center text-sm font-medium px-3 py-2 rounded-lg ${
                btStatus.includes('Gagal') || btStatus.includes('Tidak')
                  ? 'bg-red-100 text-red-700'
                  : btStatus.includes('Berhasil') || btStatus.includes('Tersambung')
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-blue-100 text-blue-700'
              }`}>
                {btStatus}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              {/* Bluetooth connect/disconnect */}
              {btPrinter ? (
                <button
                  onClick={disconnectBtPrinter}
                  className="bg-red-50 hover:bg-red-100 text-red-600 font-medium py-3 px-4 rounded-xl flex items-center gap-2 text-sm"
                >
                  <Bluetooth size={18} />
                  Putuskan
                </button>
              ) : (
                <button
                  onClick={connectBtPrinter}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium py-3 px-4 rounded-xl flex items-center gap-2 text-sm"
                >
                  <Bluetooth size={18} />
                  Sambung Printer
                </button>
              )}

              {/* Bluetooth print */}
              {btPrinter && (
                <button
                  onClick={printBtReceipt}
                  disabled={btPrinting}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-medium py-3 px-4 rounded-xl flex items-center gap-2 text-sm"
                >
                  <Printer size={18} />
                  {btPrinting ? 'Mencetak...' : 'Cetak Bluetooth'}
                </button>
              )}

              {/* Browser print */}
              <button
                onClick={printReceipt}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <Printer size={18} />
                Cetak Struk
              </button>

              <button
                onClick={() => setShowReceipt(false)}
                className="bg-amber-500 hover:bg-amber-600 text-white font-medium py-3 px-6 rounded-xl"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}