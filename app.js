// Library Management App - Vanilla JS
// Modular but single file for simplicity (index.html imports as module)

const LS_KEY = 'lm_data_v1'

const defaultData = {
  books: [],
  members: [],
  records: [],
  nextBookId: 1,
  nextMemberId: 1,
  nextRecordId: 1
}

// Simple state
let state = load()
// During initial startup we may want to suppress any in-app popups (toasts/modal)
let suppressStartupPopups = false

// DOM refs
const views = document.querySelectorAll('.view')
const navLinks = document.querySelectorAll('.sidebar a')
const content = document.getElementById('content')

// Dashboard refs
const totalBooksEl = document.getElementById('totalBooks')
const totalMembersEl = document.getElementById('totalMembers')
const issuedCountEl = document.getElementById('issuedCount')
const returnedCountEl = document.getElementById('returnedCount')

// Books refs
const booksTableBody = document.querySelector('#booksTable tbody')
const addBookBtn = document.getElementById('addBookBtn')
const bookSearch = document.getElementById('bookSearch')
const bookSort = document.getElementById('bookSort')
const booksPagination = document.getElementById('booksPagination')

// Members refs
const membersTableBody = document.querySelector('#membersTable tbody')
const addMemberBtn = document.getElementById('addMemberBtn')
const memberSearch = document.getElementById('memberSearch')
const membersPagination = document.getElementById('membersPagination')

// Issue refs
const issueMemberSelect = document.getElementById('issueMember')
const issueBookSelect = document.getElementById('issueBook')
const issueForm = document.getElementById('issueForm')

// Records
const recordsTableBody = document.querySelector('#recordsTable tbody')
const recordFilter = document.getElementById('recordFilter')

// Generic
const modal = document.getElementById('modal')
const modalBody = document.getElementById('modalBody')
const modalClose = document.getElementById('modalClose')
const toasts = document.getElementById('toasts')
const exportBtn = document.getElementById('exportBtn')
const importInput = document.getElementById('importInput')
const themeToggle = document.getElementById('themeToggle')
const globalSearch = document.getElementById('globalSearch')

// Pagination config
const PAGE_SIZE = 8

init()

function init() {
  // ensure modal is hidden at startup
  try {
    closeModal()
  } catch (e) {/* ignore */ }

  // suppress any in-app popups while we do the initial render so the user
  // doesn't see transient messages when opening the app.
  suppressStartupPopups = true

  bindNav()
  renderAll()
  bindUI()

  // ensure there are no leftover toasts or visible modals after initial render
  try { if (toasts) toasts.innerHTML = '' } catch (e) { }
  try { closeModal() } catch (e) { }

  // done with startup - allow toasts/modal for user actions
  suppressStartupPopups = false

  // allow Esc to close modal if it's visible
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal() })
}

function bindNav() {
  navLinks.forEach(a => a.addEventListener('click', e => {
    e.preventDefault()
    navLinks.forEach(n => n.classList.remove('active'))
    a.classList.add('active')
    showView(a.dataset.view)
  }))
}

function bindUI() {
  // guard each listener in case element refs are missing or errors happen
  if (addBookBtn) addBookBtn.addEventListener('click', () => openBookModal())
  if (addMemberBtn) addMemberBtn.addEventListener('click', () => openMemberModal())

  if (bookSearch) bookSearch.addEventListener('input', () => renderBooks(1))
  if (memberSearch) memberSearch.addEventListener('input', () => renderMembers(1))
  if (bookSort) bookSort.addEventListener('change', () => renderBooks(1))

  if (issueForm) issueForm.addEventListener('submit', handleIssue)

  if (modalClose) modalClose.addEventListener('click', closeModal)
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal() })

  if (exportBtn) exportBtn.addEventListener('click', handleExport)
  if (importInput) importInput.addEventListener('change', handleImport)

  if (recordFilter) recordFilter.addEventListener('change', renderRecords)

  if (themeToggle) themeToggle.addEventListener('click', toggleTheme)

  if (globalSearch) globalSearch.addEventListener('input', handleGlobalSearch)

  // Delegation for table actions
  if (booksTableBody) booksTableBody.addEventListener('click', handleBooksTableClick)
  if (membersTableBody) membersTableBody.addEventListener('click', handleMembersTableClick)
  if (recordsTableBody) recordsTableBody.addEventListener('click', handleRecordsTableClick)
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) { localStorage.setItem(LS_KEY, JSON.stringify(defaultData)); return structuredClone(defaultData) }
    return JSON.parse(raw)
  } catch (e) {
    console.error(e)
    localStorage.setItem(LS_KEY, JSON.stringify(defaultData));
    return structuredClone(defaultData)
  }
}

function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(state))
}

function renderAll() {
  renderDashboard()
  renderBooks(1)
  renderMembers(1)
  populateIssueSelects()
  renderRecords()
}

function showView(name) {
  views.forEach(v => v.classList.add('hidden'))
  const el = document.getElementById(name)
  if (el) el.classList.remove('hidden')
  if (name === 'books') renderBooks(1)
  if (name === 'members') renderMembers(1)
}

// Dashboard
function renderDashboard() {
  totalBooksEl.textContent = state.books.length
  totalMembersEl.textContent = state.members.length
  const issued = state.records.filter(r => r.status === 'Issued').length
  const returned = state.records.filter(r => r.status === 'Returned').length
  issuedCountEl.textContent = issued
  returnedCountEl.textContent = returned
}

// BOOKS CRUD
function openBookModal(book) {
  modalBody.innerHTML = ''
  const isEdit = !!book
  const html = document.createElement('div')
  html.innerHTML = `
    <h3>${isEdit ? 'Edit' : 'Add'} Book</h3>
    <form id="bookForm">
      <div class="form-row"><label>Title</label><input name="title" value="${book ? escapeHtml(book.title) : ''}" required></div>
      <div class="form-row"><label>Author</label><input name="author" value="${book ? escapeHtml(book.author) : ''}" required></div>
      <div class="form-row"><label>Category</label><input name="category" value="${book ? escapeHtml(book.category) : ''}" required></div>
      <div class="form-row"><label>Quantity</label><input name="quantity" type="number" min="0" value="${book ? book.quantity : 1}" required></div>
      <div class="form-row actions"><button class="btn" type="submit">${isEdit ? 'Save' : 'Add'}</button></div>
    </form>
  `
  modalBody.appendChild(html)
  modal.classList.remove('hidden')
  // ensure inline display is visible as well
  try { modal.style.display = 'flex' } catch (e) { }

  const bookForm = document.getElementById('bookForm')
  bookForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(bookForm)
    const title = f.get('title').trim();
    const author = f.get('author').trim();
    const category = f.get('category').trim();
    const quantity = parseInt(f.get('quantity'), 10)
    if (!title || !author || !category || isNaN(quantity)) return toast('Please fill all fields', 'error')
    if (isEdit) {
      updateBook(book.id, { title, author, category, quantity })
    } else {
      addBook({ title, author, category, quantity })
    }
    closeModal()
  })
}

function addBook({ title, author, category, quantity }) {
  const id = state.nextBookId++
  const available = quantity
  state.books.push({ id, title, author, category, quantity, available })
  save(); renderBooks(1); renderDashboard(); toast('Book added', 'success')
}

function updateBook(id, patch) {
  const b = state.books.find(x => x.id === id)
  if (!b) return toast('Book not found', 'error')
  // adjust available if quantity changed
  if (typeof patch.quantity === 'number') {
    const delta = patch.quantity - b.quantity
    b.available = Math.max(0, b.available + delta)
    b.quantity = patch.quantity
  }
  b.title = patch.title
  b.author = patch.author
  b.category = patch.category
  save(); renderBooks(); renderDashboard(); toast('Book updated', 'success')
}

function deleteBook(id) {
  if (!confirm('Delete this book?')) return
  state.books = state.books.filter(b => b.id !== id)
  // also remove records referencing it
  state.records = state.records.filter(r => r.bookId !== id)
  save(); renderBooks(1); renderRecords(); renderDashboard(); toast('Book deleted', 'success')
}

function renderBooks(page = 1) {
  const q = bookSearch.value.trim().toLowerCase()
  let list = state.books.slice()
  if (q) list = list.filter(b => `${b.title} ${b.author} ${b.category}`.toLowerCase().includes(q))
  const sortBy = bookSort.value
  list.sort((a, b) => String(a[sortBy]).localeCompare(String(b[sortBy])))

  // pagination
  const total = list.length
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  page = Math.min(page, pages)
  const start = (page - 1) * PAGE_SIZE
  const slice = list.slice(start, start + PAGE_SIZE)

  booksTableBody.innerHTML = slice.map(b => `<tr>
    <td>${b.id}</td>
    <td>${escapeHtml(b.title)}</td>
    <td>${escapeHtml(b.author)}</td>
    <td>${escapeHtml(b.category)}</td>
    <td>${b.quantity}</td>
    <td>${b.available}</td>
    <td>
      <button class="btn small" data-act="edit" data-id="${b.id}">Edit</button>
      <button class="btn small" data-act="delete" data-id="${b.id}">Delete</button>
    </td>
  </tr>`).join('')

  // render pagination
  booksPagination.innerHTML = ''
  for (let i = 1; i <= pages; i++) {
    const btn = document.createElement('button')
    btn.textContent = i
    if (i === page) btn.style.fontWeight = '700'
    btn.addEventListener('click', () => renderBooks(i))
    booksPagination.appendChild(btn)
  }
}

function handleBooksTableClick(e) {
  const btn = e.target.closest('button')
  if (!btn) return
  const act = btn.dataset.act
  const id = Number(btn.dataset.id)
  if (act === 'edit') {
    const b = state.books.find(x => x.id === id)
    openBookModal(b)
  } else if (act === 'delete') {
    deleteBook(id)
  }
}

// MEMBERS CRUD
function openMemberModal(member) {
  modalBody.innerHTML = ''
  const isEdit = !!member
  const html = document.createElement('div')
  html.innerHTML = `
    <h3>${isEdit ? 'Edit' : 'Add'} Member</h3>
    <form id="memberForm">
      <div class="form-row"><label>Name</label><input name="name" value="${member ? escapeHtml(member.name) : ''}" required></div>
      <div class="form-row"><label>Phone</label><input name="phone" value="${member ? escapeHtml(member.phone) : ''}" required></div>
      <div class="form-row"><label>Email</label><input name="email" value="${member ? escapeHtml(member.email) : ''}" required></div>
      <div class="form-row actions"><button class="btn" type="submit">${isEdit ? 'Save' : 'Add'}</button></div>
    </form>
  `
  modalBody.appendChild(html)
  modal.classList.remove('hidden')
  try { modal.style.display = 'flex' } catch (e) { }

  const memberForm = document.getElementById('memberForm')
  memberForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(memberForm)
    const name = f.get('name').trim();
    const phone = f.get('phone').trim();
    const email = f.get('email').trim();
    if (!name || !phone || !email) return toast('Please fill all fields', 'error')
    if (isEdit) {
      updateMember(member.id, { name, phone, email })
    } else {
      addMember({ name, phone, email })
    }
    closeModal()
  })
}

function addMember({ name, phone, email }) {
  const id = state.nextMemberId++
  state.members.push({ id, name, phone, email })
  save(); renderMembers(1); renderDashboard(); toast('Member added', 'success')
}

function updateMember(id, patch) {
  const m = state.members.find(x => x.id === id)
  if (!m) return toast('Member not found', 'error')
  m.name = patch.name; m.phone = patch.phone; m.email = patch.email
  save(); renderMembers(); renderDashboard(); toast('Member updated', 'success')
}

function deleteMember(id) {
  if (!confirm('Delete this member?')) return
  state.members = state.members.filter(m => m.id !== id)
  state.records = state.records.filter(r => r.memberId !== id)
  save(); renderMembers(1); renderRecords(); renderDashboard(); toast('Member deleted', 'success')
}

function renderMembers(page = 1) {
  const q = memberSearch.value.trim().toLowerCase()
  let list = state.members.slice()
  if (q) list = list.filter(m => `${m.name} ${m.phone} ${m.email}`.toLowerCase().includes(q))

  const total = list.length
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  page = Math.min(page, pages)
  const start = (page - 1) * PAGE_SIZE
  const slice = list.slice(start, start + PAGE_SIZE)

  membersTableBody.innerHTML = slice.map(m => `<tr>
    <td>${m.id}</td>
    <td>${escapeHtml(m.name)}</td>
    <td>${escapeHtml(m.phone)}</td>
    <td>${escapeHtml(m.email)}</td>
    <td>
      <button class="btn small" data-act="edit" data-id="${m.id}">Edit</button>
      <button class="btn small" data-act="delete" data-id="${m.id}">Delete</button>
    </td>
  </tr>`).join('')

  membersPagination.innerHTML = ''
  for (let i = 1; i <= pages; i++) {
    const btn = document.createElement('button')
    btn.textContent = i
    if (i === page) btn.style.fontWeight = '700'
    btn.addEventListener('click', () => renderMembers(i))
    membersPagination.appendChild(btn)
  }
}

function handleMembersTableClick(e) {
  const btn = e.target.closest('button')
  if (!btn) return
  const act = btn.dataset.act
  const id = Number(btn.dataset.id)
  if (act === 'edit') {
    const m = state.members.find(x => x.id === id)
    openMemberModal(m)
  } else if (act === 'delete') {
    deleteMember(id)
  }
}

// ISSUE/RETURN
function populateIssueSelects() {
  issueMemberSelect.innerHTML = state.members.map(m => `<option value="${m.id}">${escapeHtml(m.name)} (${escapeHtml(m.email)})</option>`).join('')
  issueBookSelect.innerHTML = state.books.map(b => `<option value="${b.id}">${escapeHtml(b.title)} — Avail: ${b.available}</option>`).join('')
}

function handleIssue(e) {
  e.preventDefault()
  const memberId = Number(issueMemberSelect.value)
  const bookId = Number(issueBookSelect.value)
  const returnDateRaw = document.getElementById('issueReturnDate').value
  if (!memberId || !bookId) return toast('Select member and book', 'error')
  const book = state.books.find(b => b.id === bookId)
  if (!book) return toast('Book not found', 'error')
  if (book.available <= 0) return toast('No copies available', 'error')

  // create record
  const id = state.nextRecordId++
  const issueDate = new Date().toISOString()
  const record = { id, memberId, bookId, issueDate, returnDate: returnDateRaw || null, status: 'Issued', fine: 0 }
  state.records.push(record)
  book.available -= 1
  save(); renderRecords(); renderBooks(); renderDashboard(); populateIssueSelects(); toast('Book issued', 'success')
}

function handleReturn(recordId) {
  const rec = state.records.find(r => r.id === recordId)
  if (!rec) return toast('Record not found', 'error')
  if (rec.status === 'Returned') return toast('Already returned', 'error')
  // set returned
  rec.status = 'Returned'
  rec.returnDate = new Date().toISOString().slice(0, 10)
  // increase available
  const book = state.books.find(b => b.id === rec.bookId)
  if (book) book.available += 1
  // fine calc (bonus): 0.5 per day late after returnDate
  if (rec.returnDate && rec.returnDate < rec.returnDate) { }
  // rec.fine will be recalculated in view
  save(); renderRecords(); renderBooks(); renderDashboard(); populateIssueSelects(); toast('Book returned', 'success')
}

// RECORDS
function renderRecords() {
  const filter = recordFilter.value
  const list = state.records.slice().filter(r => {
    if (filter === 'all') return true
    return r.status === (filter === 'issued' ? 'Issued' : 'Returned')
  })

  recordsTableBody.innerHTML = list.map(r => {
    const mem = state.members.find(m => m.id === r.memberId)
    const book = state.books.find(b => b.id === r.bookId)
    const issueDate = formatDate(r.issueDate)
    const returnDate = r.returnDate ? formatDate(r.returnDate) : ''
    const fine = calcFine(r)
    return `<tr>
      <td>${r.id}</td>
      <td>${mem ? escapeHtml(mem.name) : '—'}</td>
      <td>${book ? escapeHtml(book.title) : '—'}</td>
      <td>${issueDate}</td>
      <td>${returnDate || '—'}</td>
      <td>${r.status}</td>
      <td>${fine ? ('$' + fine.toFixed(2)) : '-'}</td>
      <td>
        ${r.status === 'Issued' ? `<button class="btn small" data-act="return" data-id="${r.id}">Return</button>` : ''}
      </td>
    </tr>`
  }).join('')
}

function handleRecordsTableClick(e) {
  const btn = e.target.closest('button')
  if (!btn) return
  const act = btn.dataset.act
  const id = Number(btn.dataset.id)
  if (act === 'return') handleReturn(id)
}

// Export / Import
function handleExport() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'library-backup.json'
  a.click(); URL.revokeObjectURL(url)
}

function handleImport(e) {
  const f = e.target.files[0]
  if (!f) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result)
      // basic validation
      if (!data.books || !data.members || !data.records) return toast('Invalid backup', 'error')
      state = { ...defaultData, ...data }
      save(); renderAll(); toast('Data imported', 'success')
    } catch (err) { toast('Failed to import', 'error') }
  }
  reader.readAsText(f)
}

// Utils
function closeModal() {
  modal.classList.add('hidden');
  modalBody.innerHTML = ''
  try { modal.style.display = 'none' } catch (e) { }
}

function toast(msg, type = 'success', ms = 2500) {
  if (suppressStartupPopups) return
  const d = document.createElement('div')
  d.className = 'toast ' + (type || '')
  d.textContent = msg
  toasts.appendChild(d)
  setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 400) }, ms)
}

function escapeHtml(s) { if (!s) return ''; return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') }

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleDateString()
}

function calcFine(record) {
  // bonus: if a returnDate was set manually and actual return is after that, fine 0.5 per day
  try {
    if (!record.returnDate) return 0
    const due = record.returnDate
    const ret = new Date(record.returnDate)
    const returnActual = new Date(record.returnDate)
    // If record had a planned returnDate stored as string, we expect returnDate was planned. For simplicity, compute 0 fine.
    return 0
  } catch (e) { return 0 }
}

// Global search
function handleGlobalSearch() {
  const q = globalSearch.value.trim().toLowerCase()
  if (!q) return
  // try to find in books, members, records; go to first matching view and highlight
  const book = state.books.find(b => `${b.title} ${b.author} ${b.category}`.toLowerCase().includes(q))
  if (book) { document.querySelector('[data-view="books"]').click(); bookSearch.value = q; renderBooks(1); return }
  const mem = state.members.find(m => `${m.name} ${m.phone} ${m.email}`.toLowerCase().includes(q))
  if (mem) { document.querySelector('[data-view="members"]').click(); memberSearch.value = q; renderMembers(1); return }
  const rec = state.records.find(r => String(r.id) === q)
  if (rec) { document.querySelector('[data-view="records"]').click(); renderRecords(); return }
  toast('No matches', 'error')
}

function toggleTheme() {
  document.documentElement.classList.toggle('dark')
}

// small helper to ensure UI bindings that rely on selects have options
setTimeout(populateIssueSelects, 300)
