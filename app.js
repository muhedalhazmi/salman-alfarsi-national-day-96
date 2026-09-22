const SUPABASE_URL =
  'https://sargzcxvmfwgttnshqzo.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_MaYiH9mSbYqxp-zFN5_YZw_hdcllh_w';


const labels = {
  student: 'طالب / طالبة',
  parent: 'ولي أمر',
  staff: 'كادر تعليمي',
  community: 'مجتمع محلي'
};


const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime'
]);


const MAX_FILE_SIZE =
  25 * 1024 * 1024;


let supabase = null;
let data = [];
let filter = 'all';
let signedUrls = new Map();


const $ = id =>
  document.getElementById(id);


/* =================================
   أدوات عامة
================================= */

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[char])
  );
}


function showStatus(message, type = 'info') {
  const el = $('formStatus');

  if (!el) return;

  el.textContent = message;
  el.className = `form-status ${type}`;
}


function setSubmitting(value) {
  const button = $('submitButton');

  if (!button) return;

  button.disabled = value;

  button.textContent = value
    ? 'جارٍ إرسال المشاركة…'
    : 'إرسال للمراجعة ↗';
}


function getFileInput() {
  return document.querySelector(
    '#form input[type="file"]'
  );
}


/* =================================
   رسالة النجاح
================================= */

function showSuccessMessage() {
  const old =
    document.getElementById(
      'successMessage'
    );

  if (old) old.remove();


  const message =
    document.createElement('div');

  message.id =
    'successMessage';


  message.innerHTML = `
    <div style="
      font-size:28px;
      margin-bottom:8px;
    ">✓</div>

    <strong style="
      display:block;
      font-size:18px;
      margin-bottom:6px;
    ">
      تم إرسال مشاركتك بنجاح
    </strong>

    <span style="
      display:block;
      font-size:14px;
      line-height:1.7;
    ">
      شكرًا لمشاركتك الوطنية.
      ستظهر المشاركة في الحائط الوطني
      بعد اعتماد الإدارة.
    </span>
  `;


  message.style.cssText = `
    position:fixed;
    top:24px;
    left:50%;
    transform:translateX(-50%);
    z-index:999999;
    width:min(90%,520px);
    padding:20px 24px;
    background:#064c43;
    color:#fff;
    border-radius:16px;
    text-align:center;
    box-shadow:0 12px 35px rgba(0,0,0,.25);
    font-family:inherit;
  `;


  document.body.appendChild(message);


  setTimeout(() => {
    message.remove();
  }, 6000);
}


/* =================================
   تهيئة النموذج
================================= */

function prepareForm() {
  const form = $('form');

  if (!form) return;


  const fileInput =
    getFileInput();


  if (fileInput) {
    fileInput.name = 'media';

    fileInput.accept =
      'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime';
  }


  const submitButton =
    $('submitButton');


  if (submitButton) {
    submitButton.type = 'submit';
  }


  const status =
    $('formStatus');


  if (status) {
    status.setAttribute(
      'aria-live',
      'polite'
    );
  }
}


/* =================================
   تحميل Supabase
================================= */

async function loadSupabase() {

  if (window.supabase) {

    supabase =
      window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
      );

    return;
  }


  await new Promise(
    (resolve, reject) => {

      const script =
        document.createElement(
          'script'
        );


      script.src =
        'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';


      script.onload = resolve;


      script.onerror = () =>
        reject(
          new Error(
            'تعذر تحميل مكتبة Supabase.'
          )
        );


      document.head.appendChild(
        script
      );
    }
  );


  if (!window.supabase) {
    throw new Error(
      'لم يتم تحميل Supabase بشكل صحيح.'
    );
  }


  supabase =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );
}


/* =================================
   تحميل المشاركات المعتمدة
================================= */

async function loadSubmissions() {

  if (!supabase) return;


  const {
    data: rows,
    error
  } =
    await supabase
      .from('submissions')
      .select(
        'id,student_name,grade,title,description,media_type,storage_path,status,submitted_at'
      )
      .eq(
        'status',
        'approved'
      )
      .order(
        'submitted_at',
        {
          ascending: false
        }
      )
      .limit(100);


  if (error) {

    console.error(
      'SUBMISSIONS SELECT ERROR:',
      error
    );

    data = [];

    render();

    return;
  }


  data =
    (rows || []).map(row => {

      let category =
        'student';


      if (
        row.title?.includes(
          'ولي أمر'
        )
      ) {
        category = 'parent';

      } else if (
        row.title?.includes(
          'كادر'
        )
      ) {
        category = 'staff';

      } else if (
        row.title?.includes(
          'مجتمع'
        )
      ) {
        category = 'community';
      }


      return {
        id: row.id,

        name:
          row.student_name,

        category,

        grade:
          row.grade || '',

        message:
          row.description || '',

        featured:
          false,

        mediaType:
          row.media_type,

        storagePath:
          row.storage_path,

        submittedAt:
          row.submitted_at
      };
    });


  signedUrls =
    new Map();


  const paths =
    data
      .map(
        item =>
          item.storagePath
      )
      .filter(Boolean);


  if (paths.length) {

    const {
      data: signed,
      error: signedError
    } =
      await supabase.storage
        .from('submissions')
        .createSignedUrls(
          paths,
          3600
        );


    if (
      !signedError &&
      signed
    ) {

      signed.forEach(item => {

        if (
          item.path &&
          item.signedUrl
        ) {

          signedUrls.set(
            item.path,
            item.signedUrl
          );
        }
      });
    }
  }


  render();
}


/* =================================
   رسم الحائط
================================= */

function render() {

  const search =
    $('search');


  const q =
    (
      search?.value || ''
    )
      .trim()
      .toLowerCase();


  const visible =
    data.filter(item => {

      const matchesFilter =
        filter === 'all' ||
        item.category === filter;


      const text =
        `${item.name} ${item.message} ${item.grade}`
          .toLowerCase();


      const matchesSearch =
        !q ||
        text.includes(q);


      return (
        matchesFilter &&
        matchesSearch
      );
    });


  if ($('total')) {
    $('total').textContent =
      data.length;
  }


  if ($('students')) {
    $('students').textContent =
      data.filter(
        item =>
          item.category ===
          'student'
      ).length;
  }


  if ($('parents')) {
    $('parents').textContent =
      data.filter(
        item =>
          item.category ===
          'parent'
      ).length;
  }


  if ($('featured')) {
    $('featured').textContent =
      data.filter(
        item =>
          item.featured
      ).length;
  }


  const wall =
    $('wallGrid');


  if (!wall) return;


  wall.innerHTML =
    visible.map(item => {

      const url =
        signedUrls.get(
          item.storagePath
        );


      let visual =
        '<div class="visual">🇸🇦</div>';


      if (url) {

        if (
          item.mediaType ===
          'video'
        ) {

          visual = `
            <video
              class="card-media"
              src="${esc(url)}"
              controls
              preload="metadata"
              playsinline>
            </video>
          `;

        } else {

          visual = `
            <img
              class="card-media"
              src="${esc(url)}"
              alt="مشاركة وطنية من ${esc(item.name)}"
              loading="lazy">
          `;
        }
      }


      return `
        <article class="card">

          ${visual}

          <div class="body">

            <div class="meta">

              <span class="badge">
                ${esc(
                  labels[
                    item.category
                  ] || 'مشاركة'
                )}
              </span>

              <span>
                ✓ معتمدة
              </span>

            </div>

            <p>
              ${esc(
                item.message
              )}
            </p>

            <div class="meta">

              <strong>
                ${esc(
                  item.name
                )}
              </strong>

              <span>
                ${esc(
                  item.grade
                )}
              </span>

            </div>

          </div>

        </article>
      `;

    }).join('');


  if ($('empty')) {
    $('empty').hidden =
      visible.length > 0;
  }
}


/* =================================
   فتح النافذة
================================= */

function openModal(category) {

  const modal =
    $('modal');


  if (!modal) {
    console.error(
      'MODAL NOT FOUND'
    );
    return;
  }


  modal.classList.add(
    'show'
  );


  modal.setAttribute(
    'aria-hidden',
    'false'
  );


  if (
    category &&
    $('category')
  ) {

    $('category').value =
      category;
  }


  setTimeout(() => {

    const input =
      $('form')?.querySelector(
        'input[name="name"]'
      );


    if (input) {
      input.focus();
    }

  }, 50);
}


/* =================================
   إغلاق النافذة
================================= */

function closeModal() {

  const modal =
    $('modal');


  if (!modal) return;


  modal.classList.remove(
    'show'
  );


  modal.setAttribute(
    'aria-hidden',
    'true'
  );


  if ($('formStatus')) {

    $('formStatus').textContent =
      '';

    $('formStatus').className =
      'form-status';
  }
}


/* =================================
   تنظيف اسم الملف
================================= */

function sanitizeFileName(name) {

  const ext =
    name.includes('.')
      ? name
          .split('.')
          .pop()
          .toLowerCase()
      : 'bin';


  const base =
    name
      .replace(
        /\\/g,
        '/'
      )
      .split('/')
      .pop()
      .replace(
        /\.[^.]+$/,
        ''
      );


  const safe =
    base
      .replace(
        /[^a-zA-Z0-9_-]+/g,
        '-'
      )
      .replace(
        /^-+|-+$/g,
        ''
      )
      .slice(
        0,
        80
      ) ||
    'submission';


  return `${safe}-${Date.now()}.${ext}`;
}


/* =================================
   إرسال المشاركة
================================= */

async function submitParticipation(
  event
) {

  event.preventDefault();
  event.stopPropagation();


  const form =
    event.currentTarget;


  if (!form) return;


  if (!supabase) {

    showStatus(
      'الاتصال بخدمة المشاركة غير جاهز. حاول تحديث الصفحة.',
      'error'
    );

    return;
  }


  const fd =
    new FormData(form);


  const file =
    fd.get('media') ||
    getFileInput()?.files?.[0];


  const name =
    String(
      fd.get('name') || ''
    ).trim();


  const category =
    String(
      fd.get('category') || ''
    );


  const grade =
    String(
      fd.get('grade') || ''
    ).trim();


  const message =
    String(
      fd.get('message') || ''
    ).trim();


  const consent =
    fd.get('consent') === 'on';


  if (
    !name ||
    !message ||
    !labels[category] ||
    !consent
  ) {

    showStatus(
      'أكمل البيانات المطلوبة ووافق على الإقرار.',
      'error'
    );

    return;
  }


  if (
    !file ||
    !(file instanceof File) ||
    file.size === 0
  ) {

    showStatus(
      'اختر صورة أو فيديو للمشاركة أولًا.',
      'error'
    );

    return;
  }


  if (
    !ALLOWED_TYPES.has(
      file.type
    )
  ) {

    showStatus(
      'نوع الملف غير مسموح.',
      'error'
    );

    return;
  }


  if (
    file.size >
    MAX_FILE_SIZE
  ) {

    showStatus(
      'حجم الملف يتجاوز 25 MB.',
      'error'
    );

    return;
  }


  const mediaType =
    file.type.startsWith(
      'video/'
    )
      ? 'video'
      : 'image';


  const submissionId =
    crypto.randomUUID();


  const storagePath =
    `${submissionId}/${mediaType}/${sanitizeFileName(file.name)}`;


  const title =
    `${labels[category]} - مشاركة اليوم الوطني`;


  setSubmitting(true);


  showStatus(
    'جارٍ رفع المشاركة…',
    'info'
  );


  try {

    const {
      error: uploadError
    } =
      await supabase.storage
        .from('submissions')
        .upload(
          storagePath,
          file,
          {
            cacheControl: '3600',
            contentType: file.type,
            upsert: false
          }
        );


    if (uploadError) {

      console.error(
        'STORAGE UPLOAD ERROR:',
        uploadError
      );

      throw new Error(
        `تعذر رفع الملف: ${uploadError.message}`
      );
    }


    showStatus(
      'تم رفع الملف. جارٍ تسجيل المشاركة…',
      'info'
    );


    const {
      error: insertError
    } =
      await supabase
        .from('submissions')
        .insert({
          id:
            submissionId,

          student_name:
            name,

          grade:
            grade || null,

          title:
            title,

          description:
            message,

          media_type:
            mediaType,

          storage_path:
            storagePath,

          guardian_consent:
            true,

          status:
            'pending'
        });


    if (insertError) {

      console.error(
        'DATABASE INSERT ERROR:',
        insertError
      );


      await supabase.storage
        .from('submissions')
        .remove([
          storagePath
        ]);


      throw new Error(
        `تعذر تسجيل المشاركة: ${insertError.message}`
      );
    }


    form.reset();


    closeModal();


    showSuccessMessage();


    location.hash =
      'wall';


    await loadSubmissions();

  } catch (error) {

    console.error(
      'SUBMISSION ERROR:',
      error
    );


    showStatus(
      error?.message ||
      'حدث خطأ غير متوقع أثناء إرسال المشاركة.',
      'error'
    );

  } finally {

    setSubmitting(false);
  }
}


/* =================================
   تجهيز الواجهة
================================= */

function setupInterface() {

  prepareForm();


  document
    .querySelectorAll(
      '.filters button'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          document
            .querySelectorAll(
              '.filters button'
            )
            .forEach(item => {

              item.classList.remove(
                'active'
              );

            });


          button.classList.add(
            'active'
          );


          filter =
            button.dataset.filter;


          render();
        }
      );
    });


  if ($('search')) {

    $('search').addEventListener(
      'input',
      render
    );
  }


  const form =
    $('form');


  if (form) {

    form.addEventListener(
      'submit',
      submitParticipation
    );
  }


  if ($('modal')) {

    $('modal').addEventListener(
      'keydown',
      event => {

        if (
          event.key ===
          'Escape'
        ) {

          closeModal();
        }
      }
    );
  }
}


/* =================================
   تشغيل التطبيق
================================= */

async function startApp() {

  /*
   * الواجهة تعمل أولًا.
   * لا ننتظر Supabase.
   */

  setupInterface();


  try {

    await loadSupabase();

  } catch (error) {

    console.error(
      'SUPABASE INIT ERROR:',
      error
    );


    showStatus(
      'تعذر الاتصال بخدمة المشاركة. حاول تحديث الصفحة.',
      'error'
    );


    return;
  }


  await loadSubmissions();
}


/* =================================
   إتاحة الدوال لـ HTML
================================= */

window.openModal =
  openModal;

window.closeModal =
  closeModal;

window.render =
  render;


/* =================================
   بدء التطبيق
================================= */

startApp();
