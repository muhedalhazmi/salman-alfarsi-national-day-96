(() => {
  // منع تشغيل الملف مرتين إذا تم تحميل admin.js أكثر من مرة
  if (window.__SALMAN_ADMIN_LOADED__) {
    console.warn('admin.js تم تحميله مسبقًا، تم تجاهل النسخة المكررة.');
    return;
  }

  window.__SALMAN_ADMIN_LOADED__ = true;

  const SUPABASE_URL = 'https://sargzcxvmfwgttnshqzo.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_MaYiH9mSbYqxp-zFN5_YZw_hdcllh_w';
  const ADMIN_EMAIL = 'muhedalhazmi@gmail.com';
  const BUCKET = 'submissions';

  // إنشاء عميل Supabase باسم مختلف لتجنب أي تعارض
  const sb = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  let currentStatus = 'pending';
  let rows = [];

  const $ = (id) => document.getElementById(id);

  function showStatus(el, message, type = 'info') {
    if (!el) return;

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

  // =========================================================
  // إرسال رابط الدخول
  // =========================================================

  async function sendMagicLink() {
    const emailInput = $('email');
    const status = $('loginStatus');

    if (!emailInput) {
      console.error('لم يتم العثور على حقل البريد الإلكتروني.');
      return;
    }

    const email = emailInput.value.trim().toLowerCase();

    if (!email) {
      showStatus(
        status,
        'أدخل البريد الإلكتروني أولًا.',
        'error'
      );
      return;
    }

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

    // العودة إلى نفس صفحة الإدارة بعد الضغط على الرابط
    const redirectTo =
      `${window.location.origin}${window.location.pathname}`;

    try {
      const { error } = await sb.auth.signInWithOtp({
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
        'تم إرسال رابط الدخول إلى بريدك الإلكتروني. افتح أحدث رسالة واضغط الرابط مرة واحدة فقط.',
        'success'
      );

    } catch (error) {
      console.error('MAGIC LINK EXCEPTION:', error);

      showStatus(
        status,
        `حدث خطأ أثناء إرسال الرابط: ${error.message || error}`,
        'error'
      );
    }
  }

  // =========================================================
  // التحقق من المستخدم
  // =========================================================

  async function getVerifiedUser() {
    try {
      const { data, error } = await sb.auth.getUser();

      if (error) {
        console.error('GET USER ERROR:', error);
        return null;
      }

      if (!data || !data.user) {
        return null;
      }

      const email = String(
        data.user.email || ''
      ).toLowerCase();

      if (email !== ADMIN_EMAIL) {
        await sb.auth.signOut({
          scope: 'local'
        });

        return null;
      }

      return data.user;

    } catch (error) {
      console.error('GET USER EXCEPTION:', error);
      return null;
    }
  }

  // =========================================================
  // الإحصاءات
  // =========================================================

  async function loadStats() {
    const { data, error } = await sb
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

    (data || []).forEach((row) => {
      if (
        Object.prototype.hasOwnProperty.call(
          counts,
          row.status
        )
      ) {
        counts[row.status]++;
      }
    });

    const pendingCount = $('pendingCount');
    const approvedCount = $('approvedCount');
    const rejectedCount = $('rejectedCount');

    if (pendingCount) {
      pendingCount.textContent = counts.pending;
    }

    if (approvedCount) {
      approvedCount.textContent = counts.approved;
    }

    if (rejectedCount) {
      rejectedCount.textContent = counts.rejected;
    }
  }

  // =========================================================
  // روابط الصور والفيديو
  // =========================================================

  async function getMediaUrl(path) {
    if (!path) {
      return '';
    }

    const { data, error } = await sb.storage
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

  // =========================================================
  // تحميل المشاركات
  // =========================================================

  async function loadRows() {
    const list = $('list');

    if (!list) {
      console.error(
        'لم يتم العثور على عنصر المشاركات #list'
      );

      return;
    }

    list.innerHTML =
      '<div class="empty">جارٍ تحميل المشاركات…</div>';

    const { data, error } = await sb
      .from('submissions')
      .select('*')
      .eq('status', currentStatus)
      .order('submitted_at', {
        ascending: false
      });

    if (error) {
      console.error(
        'LOAD ROWS ERROR:',
        error
      );

      list.innerHTML =
        `<div class="empty">${
          escapeHtml(
            `تعذر تحميل المشاركات: ${error.message}`
          )
        }</div>`;

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

    list.innerHTML = cards.length
      ? cards.join('')
      : '<div class="empty">لا توجد مشاركات في هذا القسم.</div>';
  }

  // =========================================================
  // رسم المشاركة
  // =========================================================

  async function renderRow(row) {
    const mediaUrl =
      await getMediaUrl(
        row.storage_path
      );

    const title =
      escapeHtml(
        row.title || 'مشاركة وطنية'
      );

    const name =
      escapeHtml(
        row.student_name || 'مشارك'
      );

    const grade =
      escapeHtml(
        row.grade || 'غير محدد'
      );

    const description =
      escapeHtml(
        row.description || ''
      );

    const category =
      escapeHtml(
        categoryFromTitle(row.title)
      );

    const mediaType =
      String(
        row.media_type || ''
      );

    let media =
      '<div class="media">لا توجد معاينة</div>';

    if (
      mediaUrl &&
      mediaType === 'video'
    ) {
      media = `
        <div class="media">
          <video
            src="${mediaUrl}"
            controls
            preload="metadata">
          </video>
        </div>
      `;
    } else if (mediaUrl) {
      media = `
        <div class="media">
          <img
            src="${mediaUrl}"
            alt="${title}"
            loading="lazy">
        </div>
      `;
    }

    let actionButtons = '';

    if (currentStatus === 'pending') {

      actionButtons = `
        <button
          class="btn approve"
          type="button"
          data-action="approve"
          data-id="${escapeHtml(row.id)}">
          اعتماد ونشر
        </button>

        <button
          class="btn reject"
          type="button"
          data-action="reject"
          data-id="${escapeHtml(row.id)}">
          رفض
        </button>

        <button
          class="btn delete"
          type="button"
          data-action="delete"
          data-id="${escapeHtml(row.id)}">
          حذف نهائي
        </button>
      `;

    } else if (currentStatus === 'approved') {

      actionButtons = `
        <button
          class="btn delete"
          type="button"
          data-action="delete"
          data-id="${escapeHtml(row.id)}">
          حذف نهائي
        </button>
      `;

    } else {

      actionButtons = `
        <button
          class="btn approve"
          type="button"
          data-action="approve"
          data-id="${escapeHtml(row.id)}">
          اعتماد ونشر
        </button>

        <button
          class="btn delete"
          type="button"
          data-action="delete"
          data-id="${escapeHtml(row.id)}">
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
            <br>
            تاريخ الإرسال:
            ${formatDate(row.submitted_at)}
          </div>

          <div class="message">
            ${description}
          </div>

          <div class="actions">
            ${actionButtons}
          </div>

        </div>

      </article>
    `;
  }

  // =========================================================
  // تحديث حالة المشاركة
  // =========================================================

  async function updateStatus(id, status) {
    const { error } = await sb
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

  // =========================================================
  // حذف المشاركة
  // =========================================================

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

    // حذف الملف من Storage
    if (row.storage_path) {

      const {
        error: storageError
      } = await sb.storage
        .from(BUCKET)
        .remove([
          row.storage_path
        ]);

      if (storageError) {
        console.error(
          'STORAGE DELETE ERROR:',
          storageError
        );

        alert(
          `تعذر حذف ملف المشاركة من التخزين:\n${storageError.message}`
        );

        return false;
      }
    }

    // حذف السجل من قاعدة البيانات
    const {
      error: dbError
    } = await sb
      .from('submissions')
      .delete()
      .eq('id', id);

    if (dbError) {
      console.error(
        'DATABASE DELETE ERROR:',
        dbError
      );

      alert(
        `تم حذف الملف أو تعذر حذف سجل المشاركة:\n${dbError.message}`
      );

      return false;
    }

    return true;
  }

  // =========================================================
  // تنفيذ إجراءات الأزرار
  // =========================================================

  async function handleAction(action, id) {

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

  // =========================================================
  // تحديث اللوحة بالكامل
  // =========================================================

  async function refreshAll() {
    await loadStats();
    await loadRows();
  }

  // =========================================================
  // الأحداث
  // =========================================================

  function setupEvents() {

    const loginForm =
      $('loginForm');

    if (loginForm) {

      loginForm.addEventListener(
        'submit',
        (event) => {
          event.preventDefault();
          sendMagicLink();
        }
      );
    }

    const logoutButton =
      $('logoutButton');

    if (logoutButton) {

      logoutButton.addEventListener(
        'click',
        async () => {

          await sb.auth.signOut({
            scope: 'local'
          });

          window.location.reload();
        }
      );
    }

    const refreshButton =
      $('refreshButton');

    if (refreshButton) {

      refreshButton.addEventListener(
        'click',
        refreshAll
      );
    }

    const tabs =
      $('tabs');

    if (tabs) {

      tabs.addEventListener(
        'click',
        async (event) => {

          const button =
            event.target.closest(
              '[data-status]'
            );

          if (!button) {
            return;
          }

          currentStatus =
            button.dataset.status;

          document
            .querySelectorAll('.tab')
            .forEach(
              (item) =>
                item.classList.remove(
                  'active'
                )
            );

          button.classList.add(
            'active'
          );

          await loadRows();
        }
      );
    }

    const list =
      $('list');

    if (list) {

      list.addEventListener(
        'click',
        async (event) => {

          const button =
            event.target.closest(
              '[data-action]'
            );

          if (!button) {
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

  // =========================================================
  // عرض لوحة الإدارة
  // =========================================================

  async function showAdmin() {

    const user =
      await getVerifiedUser();

    const adminPanel =
      $('adminPanel');

    const loginPanel =
      $('loginPanel');

    if (!user) {

      if (adminPanel) {
        adminPanel.classList.add(
          'hidden'
        );
      }

      if (loginPanel) {
        loginPanel.classList.remove(
          'hidden'
        );
      }

      showStatus(
        $('loginStatus'),
        'يجب الدخول بحساب الإدارة المعتمد.',
        'error'
      );

      return;
    }

    if (loginPanel) {
      loginPanel.classList.add(
        'hidden'
      );
    }

    if (adminPanel) {
      adminPanel.classList.remove(
        'hidden'
      );
    }

    const userInfo =
      $('userInfo');

    if (userInfo) {
      userInfo.textContent =
        `مسجل الدخول: ${user.email}`;
    }

    try {

      await refreshAll();

    } catch (error) {

      console.error(
        'ADMIN LOAD ERROR:',
        error
      );

      const list =
        $('list');

      if (list) {
        list.innerHTML =
          `<div class="empty">${
            escapeHtml(
              error.message
            )
          }</div>`;
      }
    }
  }

  // =========================================================
  // تشغيل الصفحة
  // =========================================================

  async function boot() {

    // نتأكد أن مكتبة Supabase موجودة
    if (!window.supabase) {

      console.error(
        'Supabase library is not loaded.'
      );

      showStatus(
        $('loginStatus'),
        'تعذر تحميل مكتبة Supabase. تحقق من admin.html.',
        'error'
      );

      return;
    }

    setupEvents();

    const user =
      await getVerifiedUser();

    if (user) {

      await showAdmin();

      return;
    }

    // فحص أخطاء رابط الدخول
    const hash =
      new URLSearchParams(
        window.location.hash.slice(1)
      );

    const errorCode =
      hash.get('error_code');

    if (errorCode) {

      const description =
        hash.get(
          'error_description'
        );

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

  // =========================================================
  // مراقبة تسجيل الدخول
  // =========================================================

  sb.auth.onAuthStateChange(
    async (event, session) => {

      if (
        event === 'SIGNED_IN' &&
        session
      ) {
        await showAdmin();
      }
    }
  );

  // بدء التطبيق
  boot();

})();
