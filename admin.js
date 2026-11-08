/* =========================================================
   إدارة المشاركات الوطنية
   مدرسة سلمان الفارسي الابتدائية
   اليوم الوطني السعودي 96
   ========================================================= */

(() => {
  'use strict';

  /* =========================================================
     منع تحميل الملف أكثر من مرة
     ========================================================= */

  if (window.__SALMAN_ADMIN_LOADED__) {
    console.warn('admin.js تم تحميله مسبقًا.');
    return;
  }

  window.__SALMAN_ADMIN_LOADED__ = true;


  /* =========================================================
     إعدادات Supabase
     ========================================================= */

  const SUPABASE_URL =
    'https://sargzcxvmfwgttnshqzo.supabase.co';

  const SUPABASE_KEY =
    'sb_publishable_MaYiH9mSbYqxp-zFN5_YZw_hdcllh_w';

  const ADMIN_EMAIL =
    'muhedalhazmi@gmail.com';

  const BUCKET =
    'submissions';


  /* =========================================================
     عميل Supabase
     ========================================================= */

  if (!window.supabase) {
    console.error('Supabase library is not loaded.');

    const status =
      document.getElementById('loginStatus');

    if (status) {
      status.textContent =
        'تعذر تحميل خدمة الدخول. أعد تحميل الصفحة.';
      status.className =
        'status error';
    }

    return;
  }


  /*
   * مهم:
   * detectSessionInUrl = true
   * حتى يستطيع Supabase التقاط جلسة Magic Link
   * القادمة من رابط البريد.
   */

  const sb =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      }
    );


  /* =========================================================
     المتغيرات
     ========================================================= */

  let currentStatus = 'pending';
  let rows = [];

  let initialized = false;
  let loadingAdmin = false;


  /* =========================================================
     أدوات مساعدة
     ========================================================= */

  const $ = (id) =>
    document.getElementById(id);


  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }


  function formatDate(value) {
    if (!value) {
      return '—';
    }

    try {
      return new Intl.DateTimeFormat(
        'ar-SA',
        {
          dateStyle: 'medium',
          timeStyle: 'short'
        }
      ).format(new Date(value));
    } catch {
      return String(value);
    }
  }


  function categoryFromTitle(title) {
    const value =
      String(title || '');

    if (value.startsWith('الطلاب')) {
      return 'الطلاب';
    }

    if (
      value.startsWith(
        'أولياء الأمور'
      )
    ) {
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


  function showStatus(
    element,
    message,
    type = 'info'
  ) {
    if (!element) {
      return;
    }

    element.textContent =
      message;

    element.className =
      `status ${type}`;
  }


  /* =========================================================
     التعامل مع رابط Magic Link
     ========================================================= */

  function cleanAuthUrl() {
    try {
      const url =
        new URL(window.location.href);

      /*
       * لا نحذف hash مباشرة إذا كان يحتوي
       * على بيانات جلسة لم يعالجها Supabase بعد.
       *
       * يتم تنظيف الرابط فقط بعد اكتمال
       * معالجة الجلسة.
       */

      url.searchParams.delete('code');

      window.history.replaceState(
        {},
        document.title,
        url.pathname +
          (url.search ? url.search : '')
      );

    } catch (error) {
      console.warn(
        'تعذر تنظيف رابط الدخول:',
        error
      );
    }
  }


  /* =========================================================
     انتظار الجلسة الأولية
     ========================================================= */

  function waitForInitialSession() {
    return new Promise(
      (resolve) => {

        let finished = false;

        const finish = (session) => {
          if (finished) {
            return;
          }

          finished = true;

          try {
            subscription.unsubscribe();
          } catch {}

          resolve(session || null);
        };


        const {
          data: {
            subscription
          }
        } =
          sb.auth.onAuthStateChange(
            (event, session) => {

              /*
               * INITIAL_SESSION:
               * الجلسة التي اكتشفها Supabase
               * عند فتح الصفحة.
               */

              if (
                event ===
                'INITIAL_SESSION'
              ) {
                finish(session);
                return;
              }


              /*
               * SIGNED_IN:
               * يحدث بعد Magic Link.
               */

              if (
                event === 'SIGNED_IN'
              ) {
                finish(session);
              }
            }
          );


        /*
         * احتياط:
         * إذا كانت الجلسة موجودة بالفعل
         * نقرأها مباشرة.
         */

        sb.auth
          .getSession()
          .then(
            ({
              data
            }) => {

              if (
                data &&
                data.session
              ) {
                finish(
                  data.session
                );
              }

            }
          )
          .catch(
            (error) => {
              console.error(
                'GET SESSION ERROR:',
                error
              );
            }
          );


        /*
         * لا نترك الصفحة معلقة إلى الأبد.
         */

        setTimeout(
          () => finish(null),
          8000
        );
      }
    );
  }


  /* =========================================================
     التحقق من حساب الإدارة
     ========================================================= */

  async function getVerifiedUser() {

    try {

      const {
        data,
        error
      } =
        await sb.auth.getUser();


      if (error) {

        console.error(
          'GET USER ERROR:',
          error
        );

        return null;
      }


      const user =
        data?.user;


      if (!user) {
        return null;
      }


      const email =
        String(
          user.email || ''
        )
          .trim()
          .toLowerCase();


      if (
        email !==
        ADMIN_EMAIL
      ) {

        console.warn(
          'محاولة دخول بحساب غير مصرح:',
          email
        );

        await sb.auth.signOut({
          scope: 'local'
        });

        return null;
      }


      return user;

    } catch (error) {

      console.error(
        'GET USER EXCEPTION:',
        error
      );

      return null;
    }
  }


  /* =========================================================
     إرسال Magic Link
     ========================================================= */

  async function sendMagicLink() {

    const emailInput =
      $('email');

    const status =
      $('loginStatus');


    if (!emailInput) {
      return;
    }


    const email =
      emailInput.value
        .trim()
        .toLowerCase();


    if (!email) {

      showStatus(
        status,
        'أدخل البريد الإلكتروني أولًا.',
        'error'
      );

      return;
    }


    if (
      email !==
      ADMIN_EMAIL
    ) {

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


    /*
     * يجب أن يعود الرابط إلى admin.html
     */

    const redirectTo =
      `${window.location.origin}${window.location.pathname}`;


    try {

      const {
        error
      } =
        await sb.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo:
              redirectTo,
            shouldCreateUser:
              false
          }
        });


      if (error) {

        console.error(
          'MAGIC LINK ERROR:',
          error
        );

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

      console.error(
        'MAGIC LINK EXCEPTION:',
        error
      );

      showStatus(
        status,
        `حدث خطأ أثناء إرسال الرابط: ${error?.message || error}`,
        'error'
      );
    }
  }


  /* =========================================================
     إحصاءات المشاركات
     ========================================================= */

  async function loadStats() {

    const {
      data,
      error
    } =
      await sb
        .from('submissions')
        .select('status');


    if (error) {

      console.error(
        'STATS ERROR:',
        error
      );

      throw new Error(
        `تعذر قراءة الإحصاءات: ${error.message}`
      );
    }


    const counts = {
      pending: 0,
      approved: 0,
      rejected: 0
    };


    (data || []).forEach(
      (row) => {

        if (
          Object.prototype.hasOwnProperty.call(
            counts,
            row.status
          )
        ) {
          counts[row.status]++;
        }

      }
    );


    const pending =
      $('pendingCount');

    const approved =
      $('approvedCount');

    const rejected =
      $('rejectedCount');


    if (pending) {
      pending.textContent =
        counts.pending;
    }

    if (approved) {
      approved.textContent =
        counts.approved;
    }

    if (rejected) {
      rejected.textContent =
        counts.rejected;
    }
  }


  /* =========================================================
     الحصول على رابط آمن للوسائط
     ========================================================= */

  async function getMediaUrl(
    storagePath
  ) {

    if (!storagePath) {
      return '';
    }


    try {

      const {
        data,
        error
      } =
        await sb.storage
          .from(BUCKET)
          .createSignedUrl(
            storagePath,
            3600
          );


      if (error) {

        console.error(
          'SIGNED URL ERROR:',
          error
        );

        return '';
      }


      return (
        data?.signedUrl ||
        ''
      );

    } catch (error) {

      console.error(
        'SIGNED URL EXCEPTION:',
        error
      );

      return '';
    }
  }


  /* =========================================================
     تحميل المشاركات للقسم الحالي
     ========================================================= */

  async function loadRows() {

    const list =
      $('list');


    if (!list) {
      return;
    }


    list.innerHTML =
      '<div class="empty">جارٍ تحميل المشاركات…</div>';


    const {
      data,
      error
    } =
      await sb
        .from('submissions')
        .select('*')
        .eq(
          'status',
          currentStatus
        )
        .order(
          'submitted_at',
          {
            ascending: false
          }
        );


    if (error) {

      console.error(
        'LOAD ROWS ERROR:',
        error
      );

      list.innerHTML =
        `<div class="empty">
          تعذر تحميل المشاركات:
          ${escapeHtml(error.message)}
        </div>`;

      return;
    }


    rows =
      Array.isArray(data)
        ? data
        : [];


    if (!rows.length) {

      list.innerHTML =
        '<div class="empty">لا توجد مشاركات في هذا القسم.</div>';

      return;
    }


    const cards = [];


    for (
      const row of rows
    ) {

      cards.push(
        await renderRow(row)
      );
    }


    list.innerHTML =
      cards.join('');
  }


  /* =========================================================
     رسم مشاركة واحدة
     ========================================================= */

  async function renderRow(
    row
  ) {

    const title =
      escapeHtml(
        row.title ||
        'مشاركة وطنية'
      );


    const name =
      escapeHtml(
        row.student_name ||
        'مشارك'
      );


    const grade =
      escapeHtml(
        row.grade ||
        'غير محدد'
      );


    const description =
      escapeHtml(
        row.description ||
        ''
      );


    const category =
      escapeHtml(
        categoryFromTitle(
          row.title
        )
      );


    const mediaType =
      String(
        row.media_type ||
        ''
      );


    const mediaUrl =
      await getMediaUrl(
        row.storage_path
      );


    let media =
      '<div class="media">لا توجد صورة أو فيديو</div>';


    /*
     * مشاركة نصية فقط:
     * مسموح بها ولا تحتاج storage_path.
     */

    if (
      mediaUrl &&
      mediaType === 'video'
    ) {

      media = `
        <div class="media">
          <video
            src="${escapeHtml(mediaUrl)}"
            controls
            preload="metadata">
          </video>
        </div>
      `;

    } else if (
      mediaUrl &&
      mediaType !== 'video'
    ) {

      media = `
        <div class="media">
          <img
            src="${escapeHtml(mediaUrl)}"
            alt="${title}"
            loading="lazy">
        </div>
      `;
    }


    let actionButtons =
      '';


    if (
      currentStatus ===
      'pending'
    ) {

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

    } else if (
      currentStatus ===
      'approved'
    ) {

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


  /* =========================================================
     تحديث حالة المشاركة
     ========================================================= */

  async function updateStatus(
    id,
    status
  ) {

    if (
      ![
        'pending',
        'approved',
        'rejected'
      ].includes(status)
    ) {
      return false;
    }


    const {
      error
    } =
      await sb
        .from('submissions')
        .update({
          status
        })
        .eq(
          'id',
          id
        );


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


  /* =========================================================
     حذف المشاركة
     ========================================================= */

  async function deleteSubmission(
    id
  ) {

    const row =
      rows.find(
        (item) =>
          String(item.id) ===
          String(id)
      );


    if (!row) {
      return false;
    }


    const ok =
      window.confirm(
        'سيتم حذف المشاركة وملفها من التخزين نهائيًا. هل تريد المتابعة؟'
      );


    if (!ok) {
      return false;
    }


    /*
     * حذف الملف إن وجد.
     * المشاركة النصية فقط ليس لها ملف.
     */

    if (
      row.storage_path
    ) {

      const {
        error:
          storageError
      } =
        await sb.storage
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
          `تعذر حذف ملف المشاركة:\n${storageError.message}`
        );

        return false;
      }
    }


    /*
     * حذف السجل من قاعدة البيانات.
     */

    const {
      error:
        dbError
    } =
      await sb
        .from('submissions')
        .delete()
        .eq(
          'id',
          id
        );


    if (dbError) {

      console.error(
        'DATABASE DELETE ERROR:',
        dbError
      );

      alert(
        `تعذر حذف سجل المشاركة:\n${dbError.message}`
      );

      return false;
    }


    return true;
  }


  /* =========================================================
     تنفيذ الإجراءات
     ========================================================= */

  async function handleAction(
    action,
    id
  ) {

    if (
      action ===
      'approve'
    ) {

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


    if (
      action ===
      'reject'
    ) {

      if (
        await updateStatus(
          id,
          'rejected'
        )
      ) {
        await refreshAll();
      }

      return;
    }


    if (
      action ===
      'delete'
    ) {

      if (
        await deleteSubmission(
          id
        )
      ) {
        await refreshAll();
      }
    }
  }


  /* =========================================================
     تحديث كامل للوحة
     ========================================================= */

  async function refreshAll() {

    await loadStats();
    await loadRows();
  }


  /* =========================================================
     إظهار لوحة الإدارة
     ========================================================= */

  async function showAdmin(
    user = null
  ) {

    if (loadingAdmin) {
      return;
    }


    loadingAdmin = true;


    try {

      /*
       * إذا لم يصل المستخدم من الحدث،
       * نتحقق منه مباشرة.
       */

      if (!user) {
        user =
          await getVerifiedUser();
      }


      const loginPanel =
        $('loginPanel');

      const adminPanel =
        $('adminPanel');


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

        return;
      }


      const email =
        String(
          user.email || ''
        ).toLowerCase();


      if (
        email !==
        ADMIN_EMAIL
      ) {
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


      await refreshAll();


      /*
       * بعد نجاح Magic Link
       * ننظف الرابط من أي بيانات إضافية.
       */

      cleanAuthUrl();

    } catch (error) {

      console.error(
        'ADMIN LOAD ERROR:',
        error
      );


      const list =
        $('list');


      if (list) {

        list.innerHTML =
          `<div class="empty">
            ${escapeHtml(
              error?.message ||
              'تعذر تحميل لوحة الإدارة.'
            )}
          </div>`;
      }

    } finally {

      loadingAdmin =
        false;
    }
  }


  /* =========================================================
     الأحداث
     ========================================================= */

  function setupEvents() {

    /*
     * تسجيل الدخول
     */

    const loginForm =
      $('loginForm');


    if (loginForm) {

      loginForm.addEventListener(
        'submit',
        async (event) => {

          event.preventDefault();

          await sendMagicLink();
        }
      );
    }


    /*
     * تسجيل الخروج
     */

    const logoutButton =
      $('logoutButton');


    if (logoutButton) {

      logoutButton.addEventListener(
        'click',
        async () => {

          try {

            await sb.auth.signOut({
              scope: 'local'
            });

          } catch (error) {

            console.error(
              'LOGOUT ERROR:',
              error
            );

          } finally {

            window.location.href =
              'admin.html';
          }
        }
      );
    }


    /*
     * تحديث
     */

    const refreshButton =
      $('refreshButton');


    if (refreshButton) {

      refreshButton.addEventListener(
        'click',
        async () => {

          const button =
            refreshButton;

          button.disabled =
            true;

          try {
            await refreshAll();
          } finally {
            button.disabled =
              false;
          }
        }
      );
    }


    /*
     * التبويبات
     */

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


          const newStatus =
            button.dataset.status;


          if (
            ![
              'pending',
              'approved',
              'rejected'
            ].includes(
              newStatus
            )
          ) {
            return;
          }


          currentStatus =
            newStatus;


          document
            .querySelectorAll(
              '.tab'
            )
            .forEach(
              (item) => {
                item.classList.remove(
                  'active'
                );
              }
            );


          button.classList.add(
            'active'
          );


          await loadRows();
        }
      );
    }


    /*
     * أزرار المشاركات
     */

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


          const action =
            button.dataset.action;

          const id =
            button.dataset.id;


          if (!action || !id) {
            return;
          }


          button.disabled =
            true;


          try {

            await handleAction(
              action,
              id
            );

          } finally {

            button.disabled =
              false;
          }
        }
      );
    }
  }


  /* =========================================================
     مراقبة Auth
     ========================================================= */

  sb.auth.onAuthStateChange(
    (event, session) => {

      console.log(
        'AUTH EVENT:',
        event,
        session
          ? 'SESSION'
          : 'NO SESSION'
      );


      /*
       * لا ننفذ استدعاءات Supabase
       * مباشرة داخل callback.
       * نؤجلها لدورة التنفيذ التالية.
       */

      if (
        event === 'SIGNED_IN' &&
        session
      ) {

        setTimeout(
          () => {
            showAdmin(
              session.user
            );
          },
          0
        );

        return;
      }


      if (
        event === 'SIGNED_OUT'
      ) {

        const adminPanel =
          $('adminPanel');

        const loginPanel =
          $('loginPanel');


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
      }
    }
  );


  /* =========================================================
     تشغيل الصفحة
     ========================================================= */

  async function boot() {

    setupEvents();


    /*
     * أهم جزء:
     *
     * لا نفحص المستخدم قبل أن تنتهي
     * عملية اكتشاف جلسة Magic Link.
     */

    const session =
      await waitForInitialSession();


    /*
     * إذا وجدت جلسة، نتحقق من المستخدم.
     */

    if (session) {

      await showAdmin(
        session.user
      );

      return;
    }


    /*
     * احتياط إضافي:
     * ربما الجلسة أصبحت متاحة بعد الفحص الأول.
     */

    const user =
      await getVerifiedUser();


    if (user) {

      await showAdmin(
        user
      );

      return;
    }


    /*
     * لا يوجد دخول.
     */

    const adminPanel =
      $('adminPanel');

    const loginPanel =
      $('loginPanel');


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


    /*
     * فحص أخطاء Magic Link.
     */

    try {

      const hash =
        new URLSearchParams(
          window.location.hash.slice(1)
        );


      const errorCode =
        hash.get(
          'error_code'
        );


      if (errorCode) {

        const description =
          hash.get(
            'error_description'
          );


        showStatus(
          $('loginStatus'),
          `تعذر إكمال الدخول: ${
            description ||
            errorCode
          }`,
          'error'
        );

      }

    } catch (error) {

      console.warn(
        'AUTH URL ERROR:',
        error
      );
    }
  }


  /*
   * تشغيل التطبيق
   */

  boot();

})();
