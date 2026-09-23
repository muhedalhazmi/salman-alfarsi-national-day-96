const SUPABASE_URL = 'https://sargzcxvmfwgttnshqzo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MaYiH9mSbYqxp-zFN5_YZw_hdcllh_w';
const ADMIN_EMAIL = 'muhedalhazmi@gmail.com';
const BUCKET = 'submissions';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentStatus = 'pending';
let rows = [];

const $ = (id) => document.getElementById(id);

function showStatus(el, message, type = 'info') {
  el.textContent = message;
  el.className = `status ${type}`;
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function categoryFromTitle(title) {
  const value = String(title || '');
  if (value.startsWith('الطلاب')) return 'الطلاب';
  if (value.startsWith('أولياء الأمور')) return 'أولياء الأمور';
  if (value.startsWith('الكادر')) return 'الكادر';
  if (value.startsWith('المجتمع')) return 'المجتمع';
  return '—';
}

async function sendMagicLink() {
  const email = $('email').value.trim().toLowerCase();
  const status = $('loginStatus');

  if (email !== ADMIN_EMAIL) {
    showStatus(status, 'هذا البريد غير مخول لدخول لوحة الإدارة.', 'error');
    return;
  }

  showStatus(status, 'جارٍ إرسال رابط الدخول…', 'info');

  const redirectTo = `${window.location.origin}${window.location.pathname}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: false
    }
  });

  if (error) {
    console.error(error);
    showStatus(
      status,
      'تعذر إرسال رابط الدخول. إذا ظهرت رسالة rate limit فانتظر قليلًا قبل إعادة المحاولة، ولا تطلب روابط متتالية.',
      'error'
    );
    return;
  }

  showStatus(
    status,
    'تم إرسال الرابط إلى البريد. افتح أحدث رسالة فقط ثم اضغط رابط الدخول مرة واحدة.',
    'success'
  );
}

async function getVerifiedUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const email = String(data.user.email || '').toLowerCase();
  if (email !== ADMIN_EMAIL) {
    await supabase.auth.signOut({ scope: 'local' });
    return null;
  }

  return data.user;
}

async function loadStats() {
  const { data, error } = await supabase
    .from('submissions')
    .select('status');

  if (error) {
    console.error(error);
    throw new Error(`تعذر قراءة الإحصاءات: ${error.message}`);
  }

  const counts = { pending: 0, approved: 0, rejected: 0 };
  (data || []).forEach((row) => {
    if (Object.prototype.hasOwnProperty.call(counts, row.status)) {
      counts[row.status]++;
    }
  });

  $('pendingCount').textContent = counts.pending;
  $('approvedCount').textContent = counts.approved;
  $('rejectedCount').textContent = counts.rejected;
}

async function getMediaUrl(path) {
  if (!path) return '';

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);

  if (error) {
    console.error('SIGNED URL ERROR:', error);
    return '';
  }

  return data?.signedUrl || '';
}

async function loadRows() {
  const list = $('list');
  list.innerHTML = '<div class="empty">جارٍ تحميل المشاركات…</div>';

  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('status', currentStatus)
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error(error);
    list.innerHTML = `<div class="empty">${escapeHtml(`تعذر تحميل المشاركات: ${error.message}`)}</div>`;
    return;
  }

  rows = Array.isArray(data) ? data : [];

  const cards = [];
  for (const row of rows) {
    cards.push(await renderRow(row));
  }

  list.innerHTML = cards.length ? cards.join('') : '<div class="empty">لا توجد مشاركات في هذا القسم.</div>';
}

async function renderRow(row) {
  const mediaUrl = await getMediaUrl(row.storage_path);
  const title = escapeHtml(row.title || 'مشاركة وطنية');
  const name = escapeHtml(row.student_name || 'مشارك');
  const grade = escapeHtml(row.grade || 'غير محدد');
  const description = escapeHtml(row.description || '');
  const category = escapeHtml(categoryFromTitle(row.title));
  const mediaType = String(row.media_type || '');

  let media = '<div class="media">لا توجد معاينة</div>';

  if (mediaUrl && mediaType === 'video') {
    media = `<div class="media"><video src="${mediaUrl}" controls preload="metadata"></video></div>`;
  } else if (mediaUrl) {
    media = `<div class="media"><img src="${mediaUrl}" alt="${title}" loading="lazy"></div>`;
  }

  const actionButtons = currentStatus === 'pending'
    ? `
      <button class="btn approve" type="button" data-action="approve" data-id="${escapeHtml(row.id)}">اعتماد ونشر</button>
      <button class="btn reject" type="button" data-action="reject" data-id="${escapeHtml(row.id)}">رفض</button>
      <button class="btn delete" type="button" data-action="delete" data-id="${escapeHtml(row.id)}">حذف نهائي</button>
    `
    : currentStatus === 'approved'
      ? `<button class="btn delete" type="button" data-action="delete" data-id="${escapeHtml(row.id)}">حذف نهائي</button>`
      : `
        <button class="btn approve" type="button" data-action="approve" data-id="${escapeHtml(row.id)}">اعتماد ونشر</button>
        <button class="btn delete" type="button" data-action="delete" data-id="${escapeHtml(row.id)}">حذف نهائي</button>
      `;

  return `
    <article class="item">
      ${media}
      <div class="content">
        <h3>${title}<span class="badge">${category}</span></h3>
        <div class="meta">
          <b>${name}</b> · الصف: ${grade}<br>
          تاريخ الإرسال: ${formatDate(row.submitted_at)}
        </div>
        <div class="message">${description}</div>
        <div class="actions">${actionButtons}</div>
      </div>
    </article>
  `;
}

async function updateStatus(id, status) {
  const { error } = await supabase
    .from('submissions')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error(error);
    alert(`تعذر تحديث المشاركة:\n${error.message}`);
    return false;
  }

  return true;
}

async function deleteSubmission(id) {
  const row = rows.find((item) => String(item.id) === String(id));
  if (!row) return false;

  const ok = window.confirm('سيتم حذف المشاركة وملفها من التخزين نهائيًا. هل تريد المتابعة؟');
  if (!ok) return false;

  if (row.storage_path) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([row.storage_path]);

    if (storageError) {
      console.error(storageError);
      alert(`تعذر حذف ملف المشاركة من التخزين:\n${storageError.message}`);
      return false;
    }
  }

  const { error: dbError } = await supabase
    .from('submissions')
    .delete()
    .eq('id', id);

  if (dbError) {
    console.error(dbError);
    alert(`تم حذف الملف أو تعذر حذف سجل المشاركة:\n${dbError.message}`);
    return false;
  }

  return true;
}

async function handleAction(action, id) {
  if (action === 'delete') {
    if (await deleteSubmission(id)) await refreshAll();
    return;
  }

  if (action === 'approve') {
    if (await updateStatus(id, 'approved')) await refreshAll();
    return;
  }

  if (action === 'reject') {
    if (await updateStatus(id, 'rejected')) await refreshAll();
  }
}

async function refreshAll() {
  await loadStats();
  await loadRows();
}

function setupEvents() {
  $('loginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    sendMagicLink();
  });

  $('logoutButton').addEventListener('click', async () => {
    await supabase.auth.signOut({ scope: 'local' });
    window.location.reload();
  });

  $('refreshButton').addEventListener('click', refreshAll);

  $('tabs').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-status]');
    if (!button) return;

    currentStatus = button.dataset.status;
    document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    await loadRows();
  });

  $('list').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    button.disabled = true;
    await handleAction(button.dataset.action, button.dataset.id);
  });
}

async function showAdmin() {
  const user = await getVerifiedUser();

  if (!user) {
    $('adminPanel').classList.add('hidden');
    $('loginPanel').classList.remove('hidden');
    showStatus($('loginStatus'), 'يجب الدخول بحساب الإدارة المعتمد.', 'error');
    return;
  }

  $('loginPanel').classList.add('hidden');
  $('adminPanel').classList.remove('hidden');
  $('userInfo').textContent = `مسجل الدخول: ${user.email}`;

  try {
    await refreshAll();
  } catch (error) {
    console.error(error);
    $('list').innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

async function boot() {
  setupEvents();

  const user = await getVerifiedUser();
  if (user) {
    await showAdmin();
    return;
  }

  const hash = new URLSearchParams(window.location.hash.slice(1));
  const errorCode = hash.get('error_code');

  if (errorCode) {
    const description = hash.get('error_description');
    showStatus(
      $('loginStatus'),
      `تعذر إكمال الدخول: ${description || errorCode}`,
      'error'
    );
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    await showAdmin();
  }
});

boot();
