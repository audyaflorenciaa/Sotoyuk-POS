import { useState, useEffect } from 'react'
import { branchAPI } from '../api'
import { useAuth } from '../AuthContext'

export default function BranchSwitcher() {
  const { user } = useAuth()
  const [branches, setBranches] = useState([])
  const [selected, setSelected] = useState(() => localStorage.getItem('branch_id') || '')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    branchAPI.list().then((res) => {
      // Non-superadmin users can only select their assigned branch
      const allowedBranches = user?.role === 'superadmin'
        ? res.data
        : res.data.filter((b) => b.id === user?.branch_id)
      setBranches(allowedBranches)
      setLoading(false)

      if (!selected && user?.branch_id) {
        setSelected(String(user.branch_id))
        localStorage.setItem('branch_id', user.branch_id)
      } else if (!selected && allowedBranches.length > 0) {
        setSelected(String(allowedBranches[0].id))
        localStorage.setItem('branch_id', allowedBranches[0].id)
      }
    }).catch(() => setLoading(false))
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setSelected(val)
    if (val) {
      localStorage.setItem('branch_id', val)
    } else {
      localStorage.removeItem('branch_id')
    }
    window.location.reload()
  }

  if (loading) return <div className="text-xs text-slate-500">Memuat cabang...</div>

  if (branches.length <= 1) return null

  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Cabang</label>
      <select
        value={selected}
        onChange={handleChange}
        className="w-full bg-slate-800 text-white text-sm rounded px-2 py-1.5 border border-slate-600 focus:border-amber-400 focus:outline-none"
      >
        {branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </div>
  )
}
