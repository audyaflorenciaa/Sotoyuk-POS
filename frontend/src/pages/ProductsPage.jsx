import { useState, useEffect } from 'react'
import { productAPI, categoryAPI } from '../api'
import { Plus, Search, Edit2, Trash2, X, Package, Upload } from 'lucide-react'

const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ sku: '', name: '', category_id: '', price: '', hpp: '', discount: '', stock: '' })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [error, setError] = useState('')

  const load = async (q = '') => {
    const params = q ? { search: q } : {}
    const r = await productAPI.list(params)
    setProducts(r.data)
  }

  useEffect(() => {
    categoryAPI.list().then((r) => setCategories(r.data))
    load()
  }, [])

  const handleSearch = (e) => {
    setSearch(e.target.value)
    load(e.target.value)
  }

  const openCreate = () => {
    setEditItem(null)
    setForm({ sku: '', name: '', category_id: '', price: '', hpp: '', discount: '', stock: '0' })
    setImageFile(null)
    setImagePreview('')
    setShowForm(true)
    setError('')
  }

  const openEdit = (p) => {
    setEditItem(p)
    setForm({
      sku: p.sku,
      name: p.name,
      category_id: p.category_id || '',
      price: String(p.price),
      hpp: String(p.hpp),
      discount: String(p.discount || ''),
      stock: String(p.stock),
    })
    setImagePreview(p.image ? `${window.location.origin}${p.image}` : '')
    setShowForm(true)
    setError('')
  }

  const handleImageChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      let imageUrl = editItem?.image || ''
      if (imageFile) {
        const r = await productAPI.uploadImage(imageFile)
        imageUrl = r.data.url
      }
      const data = {
        ...form,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        price: parseFloat(form.price) || 0,
        hpp: parseFloat(form.hpp) || 0,
        discount: parseFloat(form.discount) || 0,
        stock: parseInt(form.stock) || 0,
        image: imageUrl,
      }
      if (editItem) {
        await productAPI.update(editItem.id, data)
      } else {
        await productAPI.create(data)
      }
      setShowForm(false)
      load(search)
    } catch (err) {
      setError(err.response?.data?.detail || 'Gagal menyimpan')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Yakin hapus produk ini?')) return
    try {
      await productAPI.delete(id)
      load(search)
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal menghapus')
    }
  }

  const handleImportExcel = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!window.confirm(`Import ${file.name}? Data dengan SKU yang sama akan diperbarui.`)) return
    try {
      const r = await productAPI.importExcel(file)
      const { created, updated, errors } = r.data
      let msg = `Import selesai: ${created} baru, ${updated} diperbarui`
      if (errors.length) msg += `\n\nError:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...dan ${errors.length - 5} lagi` : ''}`
      alert(msg)
      load(search)
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal import Excel')
    }
    e.target.value = ''
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Produk</h1>
        <div className="flex items-center gap-3">
          <label className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium cursor-pointer transition-colors">
            <Upload size={16} />
            <span>Import Excel</span>
            <input type="file" accept=".xlsx" hidden onChange={handleImportExcel} />
          </label>
          <button
            onClick={openCreate}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
          >
            <Plus size={16} /> Tambah Produk
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={handleSearch}
          className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
          placeholder="Cari nama atau SKU..."
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Gambar</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">SKU</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nama</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Kategori</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Harga</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Diskon</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">HPP</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Stok</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {p.image ? (
                      <img
                        src={`${window.location.origin}${p.image}`}
                        alt={p.name}
                        className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                        onError={(e) => { e.target.style.display = 'none' }}
                      />
                    ) : (
                      <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                        <Package size={20} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.sku}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.category_name || '-'}</td>
                  <td className="px-4 py-3 text-right font-medium text-amber-600">{fmt(p.price)}</td>
                  <td className="px-4 py-3 text-right text-red-500">{p.discount ? fmt(p.discount) : '-'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{fmt(p.hpp)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${p.stock < 10 ? 'text-red-500' : 'text-slate-600'}`}>
                    {p.stock}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => openEdit(p)} className="text-blue-500 hover:text-blue-700 mx-1">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700 mx-1">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {products.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Package size={48} className="mx-auto mb-2 opacity-30" />
            <p>Produk tidak ditemukan</p>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editItem ? 'Edit Produk' : 'Tambah Produk'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">SKU</label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                    required
                    disabled={!!editItem}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Pilih Kategori</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Produk</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Gambar Produk</label>
                <div className="flex items-center gap-3">
                  <label className="border border-dashed border-slate-300 rounded-lg px-4 py-3 text-center cursor-pointer hover:bg-slate-50 transition-colors flex-1">
                    <input type="file" accept="image/*" hidden onChange={handleImageChange} />
                    <span className="text-sm text-slate-600">Pilih gambar</span>
                  </label>
                  {imagePreview && (
                    <img
                      src={imagePreview}
                      alt="preview"
                      className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                    />
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">Format: JPG, PNG, WebP (maks 2MB)</p>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Harga Jual</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Diskon (Rp)</label>
                  <input
                    type="number"
                    value={form.discount}
                    onChange={(e) => setForm({ ...form, discount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">HPP</label>
                  <input
                    type="number"
                    value={form.hpp}
                    onChange={(e) => setForm({ ...form, hpp: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stok</label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                {editItem ? 'Simpan Perubahan' : 'Tambah Produk'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}