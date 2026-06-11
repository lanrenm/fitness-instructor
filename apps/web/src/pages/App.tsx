import { useState, useEffect } from 'react'

// API 直接调用 (用户服务)
async function fetchUsers() {
  const res = await fetch('/users')
  return res.json()
}

// BFF 调用 (项目服务)
async function fetchProjects() {
  const res = await fetch('/bff/api/projects')
  return res.json()
}

async function login(username: string, password: string) {
  const res = await fetch('/bff/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return res.json()
}

export default function App() {
  const [users, setUsers] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // 1. 调用 API 的 user 接口
  async function loadUsers() {
    setLoading(true)
    try {
      const data = await fetchUsers()
      setUsers(data)
    } catch (e) {
      console.error('Failed to fetch users:', e)
    }
    setLoading(false)
  }

  // 2. 调用 BFF 的 project 接口
  async function loadProjects() {
    setLoading(true)
    try {
      const data = await fetchProjects()
      setProjects(data)
    } catch (e) {
      console.error('Failed to fetch projects:', e)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>🏃 Fitness Instructor Demo</h1>

      {/* 1. 查询 user - 调用 API */}
      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>1. 用户列表 (调用 API: /users)</h2>
        <button onClick={loadUsers} disabled={loading}>
          {loading ? '加载中...' : '刷新用户'}
        </button>
        <ul>
          {users.map(user => (
            <li key={user.id}>
              {user.name || user.email} ({user.email})
            </li>
          ))}
        </ul>
      </section>

      {/* 2. 查询 project - 调用 BFF */}
      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>2. 项目列表 (调用 BFF: /bff/api/projects)</h2>
        <button onClick={loadProjects} disabled={loading}>
          {loading ? '加载中...' : '刷新项目'}
        </button>
        <ul>
          {projects.map(project => (
            <li key={project.id}>{project.name}</li>
          ))}
        </ul>
      </section>

      {/* 3. 访问登录页 - MF 远端动态加载 */}
      <section style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>3. 登录页面 (MF 远端加载)</h2>
        <a href="/login">
          打开登录页
        </a>
      </section>
    </div>
  )
}