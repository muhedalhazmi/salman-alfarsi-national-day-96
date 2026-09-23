const SUPABASE_URL = 'https://sargzcxvmfwgttnshqzo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MaYiH9mSbYqxp-zFN5_YZw_hdcllh_w';

const ADMIN_EMAIL = 'muhedalhazmi@gmail.com';
const BUCKET = 'submissions';

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let currentStatus = 'pending';
let rows = [];

const $ = (id) => document.getElementById(id);

/* =========================
   Helpers
========================= */

function showStatus(element, message, type = 'info') {
  if (!element) return;

  element.textContent = message;
  element.className = `status ${type}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value) {
  if (!value) return 'غير محدد';

  try {
    return new Intl.DateTimeFormat('ar-SA', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  } catch {
    return 'غير محدد';
  }
}

function categoryFromTitle(title) {
  const value = String(title || '');

  if (value.startsWith('الطلاب')) {
    return 'الطلاب';
  }

  if (value.startsWith('أولياء الأمور')) {
    return 'أولياء الأمور';
  }

  if (value.startsWith('الكادر')) {
    return 'الكادر';
  }

  if (value.startsWith('المجتمع')) {
    return 'المجتمع';
  }

  return '—';
}

function getSubmissionDate(row) {
  /*
    جدول submissions الذي فحصناه لا يحتوي submitted_at.
    نحاول استخدام created_at إن وجد،
    وإلا نعرض "غير محدد".
  */
  return row.created_at || row.createdAt || null;
}

/* =========================
   Authentication
========================= */

async function sendMagicLink() {
  const emailInput = $('email');
  const status = $('loginStatus');

  if (!emailInput || !status) return;

  const email = emailInput.value.trim().toLowerCase();

  if (email !== ADMIN_EMAIL) {
    showStatus(
      status,
      'هذا البريد غير مخول لدخول لوحة الإدارة.',
      'error'
    );
    return;
  }

  showStatus(
    status,
    'جارٍ إرسال رابط الدخول…',
    'info'
  );

  const redirectTo =
    `${window.location.origin}${window.location.pathname}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: false
    }
  });

  if (error) {
    console.error('MAGIC LINK ERROR:', error);

    showStatus(
      status,
      `تعذر إرسال رابط الدخول: ${error.message}`,
      'error'
    );

    return;
  }

  showStatus(
    status,
    'تم إرسال رابط الدخول إلى البريد الإلكتروني. افتح أحدث رسالة واضغط الرابط مرة واحدة.',
    'success'
  );
}

async function getVerifiedUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return null;
  }

  const email = String(
    data.user.email || ''
  ).toLowerCase();

  if (email !== ADMIN_EMAIL) {
    await supabase.auth.signOut({
      scope: 'local'
    });

    return null;
  }

  return data.user;
}

/* =========================
   Statistics
========================= */

async function loadStats() {
  const { data, error } = await supabase
    .from('submissions')
    .select('status');

  if (error) {
    console.error('STATS ERROR:', error);

    throw new Error(
      `تعذر قراءة الإحصاءات: ${error.message}`
    );
  }

  const counts = {
    pending: 0,
    approved: 0,
    rejected: 0
  };

  for (const row of data || []) {
    if (
      Object.prototype.hasOwnProperty.call(
        counts,
        row.status
      )
    ) {
      counts[row.status]++;
    }
  }

  $('pendingCount').textContent = counts.pending;
  $('approvedCount').textContent = counts.approved;
  $('rejectedCount').textContent = counts.rejected;
}

/* =========================
   Storage
========================= */

async function getMediaUrl(path) {
  if (!path) {
    return '';
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);

  if (error) {
    console.error(
      'SIGNED URL ERROR:',
      error
    );

    return '';
  }

  return data?.signedUrl || '';
}

/* =========================
   Load submissions
========================= */

async function loadRows() {
  const list = $('list');

  if (!list) return;

  list.innerHTML =
    '<div class="empty">جارٍ تحميل المشاركات…</div>';

  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('status', currentStatus)
    .order('id', {
      ascending: false
    });

  if (error) {
    console.error(
      'LOAD SUBMISSIONS ERROR:',
      error
    );

    list.innerHTML = `
      <div class="empty">
        ${escapeHtml(
          `تعذر تحميل المشاركات: ${error.message}`
        )}
      </div>
    `;

    return;
  }

  rows = Array.isArray(data)
    ? data
    : [];

  const cards = [];

  for (const row of rows) {
    cards.push(
      await renderRow(row)
    );
  }

  if (cards.length === 0) {
    list.innerHTML =
      '<div class="empty">لا توجد مشاركات في هذا القسم.</div>';

    return;
  }

  list.innerHTML = cards.join('');
}

/* =========================
   Render submission
========================= */

async function renderRow(row) {
  const mediaUrl = await getMediaUrl(
    row.storage_path
  );

  const title = escapeHtml(
    row.title || 'مشاركة وطنية'
  );

  const name = escapeHtml(
    row.student_name || 'مشارك'
  );

  const grade = escapeHtml(
    row.grade || 'غير محدد'
  );

  const className = escapeHtml(
    row.class_name || ''
  );

  const description = escapeHtml(
    row.description || ''
  );

  const category = escapeHtml(
    categoryFromTitle(row.title)
  );

  const mediaType = String(
    row.media_type || ''
  ).toLowerCase();

  const date = formatDate(
    getSubmissionDate(row)
  );

  /* =========================
     Media preview
  ========================= */

  let media = `
    <div class="media">
      <span>مشاركة نصية بدون مرفق</span>
    </div>
  `;

  if (
    mediaUrl &&
    mediaType === 'video'
  ) {
    media = `
      <div class="media">
        <video
          src="${escapeHtml(mediaUrl)}"
          controls
          preload="metadata"
        ></video>
      </div>
    `;
  } else if (
    mediaUrl &&
    (
      mediaType === 'image' ||
      mediaType === 'photo'
    )
  ) {
    media = `
      <div class="media">
        <img
          src="${escapeHtml(mediaUrl)}"
          alt="${title}"
          loading="lazy"
        >
      </div>
    `;
  }

  /* =========================
     Action buttons
  ========================= */

  let actionButtons = '';

  if (currentStatus === 'pending') {
    actionButtons = `
      <button
        class="btn approve"
        type="button"
        data-action="approve"
        data-id="${escapeHtml(row.id)}"
      >
        اعتماد ونشر
      </button>

      <button
        class="btn reject"
        type="button"
        data-action="reject"
        data-id="${escapeHtml(row.id)}"
      >
        رفض
      </button>

      <button
        class="btn delete"
        type="button"
        data-action="delete"
        data-id="${escapeHtml(row.id)}"
      >
        حذف نهائي
      </button>
    `;
  } else if (currentStatus === 'approved') {
    actionButtons = `
      <button
        class="btn delete"
        type="button"
        data-action="delete"
        data-id="${escapeHtml(row.id)}"
      >
        حذف نهائي
      </button>
    `;
  } else if (currentStatus === 'rejected') {
    actionButtons = `
      <button
        class="btn approve"
        type="button"
        data-action="approve"
        data-id="${escapeHtml(row.id)}"
      >
        اعتماد ونشر
      </button>

      <button
        class="btn delete"
        type="button"
        data-action="delete"
        data-id="${escapeHtml(row.id)}"
      >
        حذف نهائي
      </button>
    `;
  }

  return `
    <article class="item">

      ${media}

      <div class="content">

        <h3>
          ${title}
          <span class="badge">
            ${category}
          </span>
        </h3>

        <div class="meta">
          <b>${name}</b>
          · الصف: ${grade}

          ${
            className
              ? ` · الفصل: ${className}`
              : ''
          }

          <br>

          تاريخ الإرسال:
          ${date}
        </div>

        <div class="message">
          ${description || '—'}
        </div>

        <div class="actions">
          ${actionButtons}
        </div>

      </div>

    </article>
  `;
}

/* =========================
   Update status
========================= */

async function updateStatus(id, status) {
  const allowedStatuses = [
    'pending',
    'approved',
    'rejected'
  ];

  if (!allowedStatuses.includes(status)) {
    console.error(
      'INVALID STATUS:',
      status
    );

    return false;
  }

  const { error } = await supabase
    .from('submissions')
    .update({
      status
    })
    .eq('id', id);

  if (error) {
    console.error(
      'UPDATE STATUS ERROR:',
      error
    );

    alert(
      `تعذر تحديث المشاركة:\n${error.message}`
    );

    return false;
  }

  return true;
}

/* =========================
   Delete submission
========================= */

async function deleteSubmission(id) {
  const row = rows.find(
    (item) =>
      String(item.id) === String(id)
  );

  if (!row) {
    return false;
  }

  const ok = window.confirm(
    'سيتم حذف المشاركة وملفها من التخزين نهائيًا. هل تريد المتابعة؟'
  );

  if (!ok) {
    return false;
  }

  /* Delete media only when it exists */
  if (row.storage_path) {
    const { error: storageError } =
      await supabase.storage
        .from(BUCKET)
        .remove([
          row.storage_path
        ]);

    if (storageError) {
      console.error(
        'DELETE STORAGE ERROR:',
        storageError
      );

      alert(
        `تعذر حذف ملف المشاركة من التخزين:\n${storageError.message}`
      );

      return false;
    }
  }

  /* Delete database record */
  const { error: dbError } =
    await supabase
      .from('submissions')
      .delete()
      .eq('id', id);

  if (dbError) {
    console.error(
      'DELETE DATABASE ERROR:',
      dbError
    );

    alert(
      `تعذر حذف سجل المشاركة:\n${dbError.message}`
    );

    return false;
  }

  return true;
}

/* =========================
   Actions
========================= */

async function handleAction(
  action,
  id
) {
  if (action === 'delete') {
    if (
      await deleteSubmission(id)
    ) {
      await refreshAll();
    }

    return;
  }

  if (action === 'approve') {
    if (
      await updateStatus(
        id,
        'approved'
      )
    ) {
      await refreshAll();
    }

    return;
  }

  if (action === 'reject') {
    if (
      await updateStatus(
        id,
        'rejected'
      )
    ) {
      await refreshAll();
    }
  }
}

/* =========================
   Refresh
========================= */

async function refreshAll() {
  await loadStats();
  await loadRows();
}

/* =========================
   Events
========================= */

function setupEvents() {
  const loginForm = $('loginForm');
  const logoutButton = $('logoutButton');
  const refreshButton = $('refreshButton');
  const tabs = $('tabs');
  const list = $('list');

  if (loginForm) {
    loginForm.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        sendMagicLink();
      }
    );
  }

  if (logoutButton) {
    logoutButton.addEventListener(
      'click',
      async () => {
        await supabase.auth.signOut({
          scope: 'local'
        });

        window.location.reload();
      }
    );
  }

  if (refreshButton) {
    refreshButton.addEventListener(
      'click',
      async () => {
        refreshButton.disabled = true;

        try {
          await refreshAll();
        } catch (error) {
          console.error(
            'REFRESH ERROR:',
            error
          );
        } finally {
          refreshButton.disabled = false;
        }
      }
    );
  }

  if (tabs) {
    tabs.addEventListener(
      'click',
      async (event) => {
        const button =
          event.target.closest(
            '[data-status]'
          );

        if (!button) return;

        currentStatus =
          button.dataset.status;

        document
          .querySelectorAll('.tab')
          .forEach((item) => {
            item.classList.remove(
              'active'
            );
          });

        button.classList.add(
          'active'
        );

        await loadRows();
      }
    );
  }

  if (list) {
    list.addEventListener(
      'click',
      async (event) => {
        const button =
          event.target.closest(
            '[data-action]'
          );

        if (!button) return;

        if (button.disabled) {
          return;
        }

        button.disabled = true;

        try {
          await handleAction(
            button.dataset.action,
            button.dataset.id
          );
        } finally {
          button.disabled = false;
        }
      }
    );
  }
}

/* =========================
   Admin screen
========================= */

async function showAdmin() {
  const user =
    await getVerifiedUser();

  if (!user) {
    $('adminPanel')
      .classList.add('hidden');

    $('loginPanel')
      .classList.remove('hidden');

    showStatus(
      $('loginStatus'),
      'يجب الدخول بحساب الإدارة المعتمد.',
      'error'
    );

    return;
  }

  $('loginPanel')
    .classList.add('hidden');

  $('adminPanel')
    .classList.remove('hidden');

  $('userInfo').textContent =
    `مسجل الدخول: ${user.email}`;

  try {
    await refreshAll();
  } catch (error) {
    console.error(
      'ADMIN LOAD ERROR:',
      error
    );

    $('list').innerHTML = `
      <div class="empty">
        ${escapeHtml(
          error.message ||
          'تعذر تحميل لوحة الإدارة.'
        )}
      </div>
    `;
  }
}

/* =========================
   Boot
========================= */

async function boot() {
  setupEvents();

  const user =
    await getVerifiedUser();

  if (user) {
    await showAdmin();
    return;
  }

  const hash =
    new URLSearchParams(
      window.location.hash.slice(1)
    );

  const errorCode =
    hash.get('error_code');

  if (errorCode) {
    const description =
      hash.get('error_description');

    showStatus(
      $('loginStatus'),
      `تعذر إكمال الدخول: ${
        description || errorCode
      }`,
      'error'
    );

    history.replaceState(
      null,
      '',
      window.location.pathname +
      window.location.search
    );
  }
}

/* =========================
   Auth state
========================= */

supabase.auth.onAuthStateChange(
  async (event, session) => {
    if (
      event === 'SIGNED_IN' &&
      session
    ) {
      await showAdmin();
    }
  }
);

boot();
