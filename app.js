/* =================================
   منصة اليوم الوطني السعودي 96
   مدرسة سلمان الفارسي الابتدائية
================================= */


/* =================================
   إعدادات Supabase
================================= */

const SUPABASE_URL =
  'https://sargzcxvmfwgttnshqzo.supabase.co';

const SUPABASE_KEY =
  'sb_publishable_MaYiH9mSbYqxp-zFN5_YZw_hdcllh_w';


/* =================================
   المتغيرات العامة
================================= */

let supabaseClient = null;

let submissions = [];

let currentFilter = 'all';

let isSubmitting = false;


/* =================================
   التصنيفات
================================= */

const labels = {
  student: 'الطلاب',
  parent: 'أولياء الأمور',
  staff: 'الكادر',
  community: 'المجتمع'
};


/* =================================
   إعدادات الملفات
================================= */

const MAX_FILE_SIZE =
  25 * 1024 * 1024;

const ALLOWED_TYPES =
  new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]);


/* =================================
   تحميل Supabase
================================= */

function loadSupabase() {

  if (
    typeof window.supabase === 'undefined'
  ) {

    console.error(
      'Supabase library is not loaded.'
    );

    return false;
  }

  try {

    supabaseClient =
      window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
      );

    return true;

  } catch (error) {

    console.error(
      'SUPABASE CLIENT ERROR:',
      error
    );

    return false;
  }
}


/* =================================
   عناصر الصفحة
================================= */

function getModal() {
  return document.getElementById('modal');
}


function getForm() {
  return document.getElementById('form');
}


function getStatus() {
  return document.getElementById('formStatus');
}


function getSubmitButton() {
  return document.getElementById(
    'submitButton'
  );
}


function getFileInput() {

  const form =
    getForm();

  if (!form) return null;

  return form.querySelector(
    'input[name="media"]'
  );
}


/* =================================
   رسالة الحالة
================================= */

function showStatus(
  message,
  type = 'info'
) {

  const status =
    getStatus();

  if (!status) {

    console.log(
      `[${type}] ${message}`
    );

    return;
  }

  status.textContent =
    message;

  status.className =
    'form-status';

  status.classList.add(
    type
  );

  status.style.display =
    'block';
}


/* =================================
   إخفاء رسالة الحالة
================================= */

function hideStatus() {

  const status =
    getStatus();

  if (!status) return;

  status.textContent =
    '';

  status.style.display =
    'none';

  status.className =
    'form-status';
}


/* =================================
   حالة زر الإرسال
================================= */

function setSubmitting(
  value
) {

  isSubmitting =
    value;

  const button =
    getSubmitButton();

  if (!button) return;

  if (value) {

    button.disabled =
      true;

    button.dataset.originalText =
      button.textContent;

    button.textContent =
      'جارٍ إرسال المشاركة…';

  } else {

    button.disabled =
      false;

    button.textContent =
      button.dataset.originalText ||
      'إرسال المشاركة';
  }
}


/* =================================
   فتح النافذة
================================= */

function openModal(
  category = ''
) {

  const modal =
    getModal();

  if (!modal) {

    console.error(
      'Modal element not found.'
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
    document.getElementById(
      'category'
    )
  ) {

    document.getElementById(
      'category'
    ).value =
      category;
  }

  hideStatus();

  setTimeout(
    function () {

      const input =
        document.querySelector(
          '#form input[name="name"]'
        );

      if (input) {
        input.focus();
      }

    },
    100
  );
}


/* =================================
   إغلاق النافذة
================================= */

function closeModal() {

  const modal =
    getModal();

  if (!modal) return;

  modal.classList.remove(
    'show'
  );

  modal.setAttribute(
    'aria-hidden',
    'true'
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

  if (old) {
    old.remove();
  }

  const message =
    document.createElement(
      'div'
    );

  message.id =
    'successMessage';

  message.innerHTML = `
    <div style="
      font-size:42px;
      line-height:1;
      margin-bottom:14px;
    ">
      ✓
    </div>

    <strong style="
      display:block;
      font-size:21px;
      margin-bottom:10px;
    ">
      تم إرسال مشاركتك بنجاح
    </strong>

    <span style="
      display:block;
      font-size:15px;
      line-height:1.9;
      margin-bottom:18px;
    ">
      شكرًا لمشاركتك الوطنية.
      تم استلام المشاركة وهي الآن
      بانتظار اعتماد الإدارة.
    </span>

    <button
      id="successOkButton"
      type="button"
      style="
        border:0;
        padding:10px 28px;
        border-radius:10px;
        background:#ffffff;
        color:#064c43;
        font-family:inherit;
        font-size:15px;
        font-weight:700;
        cursor:pointer;
      "
    >
      حسنًا
    </button>
  `;

  message.style.cssText = `
    position:fixed;
    top:50%;
    left:50%;
    transform:translate(-50%,-50%);
    z-index:999999;
    width:min(90%,520px);
    padding:30px 26px;
    background:#064c43;
    color:#ffffff;
    border-radius:20px;
    text-align:center;
    box-shadow:0 20px 60px rgba(0,0,0,.35);
    font-family:inherit;
  `;

  document.body.appendChild(
    message
  );

  const button =
    document.getElementById(
      'successOkButton'
    );

  if (button) {

    button.addEventListener(
      'click',
      function () {

        message.remove();

        location.hash =
          'wall';
      }
    );
  }
}


/* =================================
   تنظيف اسم الملف
================================= */

function sanitizeFileName(
  fileName
) {

  return String(
    fileName || 'file'
  )
    .normalize('NFKD')
    .replace(
      /[^\w.\-]+/g,
      '_'
    )
    .replace(
      /_+/g,
      '_'
    )
    .replace(
      /^_+|_+$/g,
      ''
    )
    .slice(
      0,
      120
    ) || 'file';
}


/* =================================
   تحديد التصنيف من عنوان المشاركة
================================= */

function getCategoryFromTitle(
  title
) {

  const value =
    String(
      title || ''
    );

  if (
    value.startsWith(
      'الطلاب'
    )
  ) {
    return 'student';
  }

  if (
    value.startsWith(
      'أولياء الأمور'
    )
  ) {
    return 'parent';
  }

  if (
    value.startsWith(
      'الكادر'
    )
  ) {
    return 'staff';
  }

  if (
    value.startsWith(
      'المجتمع'
    )
  ) {
    return 'community';
  }

  return 'student';
}


/* =================================
   تحميل المشاركات المعتمدة
================================= */

async function loadSubmissions() {

  if (!supabaseClient) {
    return;
  }

  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from('submissions')
        .select('*')
        .eq(
          'status',
          'approved'
        )
        .order(
          'submitted_at',
          {
            ascending: false
          }
        );

    if (error) {

      console.error(
        'LOAD SUBMISSIONS ERROR:',
        error
      );

      return;
    }

    submissions =
      Array.isArray(data)
        ? data
        : [];

    console.log(
      'APPROVED SUBMISSIONS:',
      submissions
    );

    updateStats();

    render();

  } catch (error) {

    console.error(
      'LOAD ERROR:',
      error
    );
  }
}


/* =================================
   إحصائيات المشاركات
================================= */

function updateStats() {

  const total =
    document.getElementById(
      'total'
    );

  const students =
    document.getElementById(
      'students'
    );

  const parents =
    document.getElementById(
      'parents'
    );

  const featured =
    document.getElementById(
      'featured'
    );

  if (total) {

    total.textContent =
      submissions.length;
  }

  let studentCount = 0;

  let parentCount = 0;

  submissions.forEach(
    function (item) {

      const category =
        getCategoryFromTitle(
          item.title
        );

      if (
        category ===
        'student'
      ) {

        studentCount++;
      }

      if (
        category ===
        'parent'
      ) {

        parentCount++;
      }
    }
  );

  if (students) {

    students.textContent =
      studentCount;
  }

  if (parents) {

    parents.textContent =
      parentCount;
  }

  if (featured) {

    featured.textContent =
      submissions.filter(
        item =>
          item.featured === true ||
          item.featured === 1
      ).length;
  }
}


/* =================================
   الحصول على رابط الوسائط
================================= */

function getMediaUrl(
  storagePath
) {

  if (
    !supabaseClient ||
    !storagePath
  ) {
    return '';
  }

  try {

    const result =
      supabaseClient.storage
        .from('submissions')
        .getPublicUrl(
          storagePath
        );

    return (
      result?.data?.publicUrl ||
      ''
    );

  } catch (error) {

    console.error(
      'MEDIA URL ERROR:',
      error
    );

    return '';
  }
}


/* =================================
   عرض المشاركات
================================= */

function render() {

  const container =
    document.getElementById(
      'wallGrid'
    );

  const empty =
    document.getElementById(
      'empty'
    );

  if (!container) {

    console.error(
      'wallGrid element not found.'
    );

    return;
  }

  let items =
    Array.isArray(
      submissions
    )
      ? submissions
      : [];


  /* -----------------------------
     فلترة التصنيف
  ----------------------------- */

  if (
    currentFilter !==
    'all'
  ) {

    items =
      items.filter(
        function (item) {

          return (
            getCategoryFromTitle(
              item.title
            ) ===
            currentFilter
          );
        }
      );
  }


  /* -----------------------------
     البحث
  ----------------------------- */

  const search =
    document.getElementById(
      'search'
    );

  const searchValue =
    String(
      search?.value || ''
    )
      .trim()
      .toLowerCase();

  if (searchValue) {

    items =
      items.filter(
        function (item) {

          const text =
            [
              item.student_name,
              item.title,
              item.description,
              item.grade
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

          return text.includes(
            searchValue
          );
        }
      );
  }


  /* -----------------------------
     لا توجد نتائج
  ----------------------------- */

  if (!items.length) {

    container.innerHTML =
      '';

    if (empty) {

      empty.hidden =
        false;
    }

    return;
  }


  if (empty) {

    empty.hidden =
      true;
  }


  /* -----------------------------
     عرض البطاقات
  ----------------------------- */

  container.innerHTML =
    items
      .map(
        createSubmissionCard
      )
      .join('');
}


/* =================================
   بطاقة المشاركة
================================= */

function createSubmissionCard(
  item
) {

  const name =
    escapeHtml(
      item.student_name ||
      'مشارك'
    );

  const title =
    escapeHtml(
      item.title ||
      'مشاركة وطنية'
    );

  const description =
    escapeHtml(
      item.description ||
      ''
    );

  const grade =
    escapeHtml(
      item.grade ||
      ''
    );

  const mediaUrl =
    getMediaUrl(
      item.storage_path
    );

  let media =
    '';


  if (
    item.media_type ===
    'video'
  ) {

    media = `
      <div class="submission-media">

        <video
          src="${mediaUrl}"
          controls
          preload="metadata"
        ></video>

      </div>
    `;

  } else if (
    mediaUrl
  ) {

    media = `
      <div class="submission-media">

        <img
          src="${mediaUrl}"
          alt="${title}"
          loading="lazy"
        >

      </div>
    `;
  }


  return `
    <article
      class="submission-card"
      data-category="${getCategoryFromTitle(item.title)}"
    >

      ${media}

      <div class="submission-content">

        <h3>
          ${title}
        </h3>

        <p>
          ${description}
        </p>

        <div class="submission-meta">

          <strong>
            ${name}
          </strong>

          ${
            grade &&
            grade !== 'غير محدد'
              ? `<span> — ${grade}</span>`
              : ''
          }

        </div>

      </div>

    </article>
  `;
}


/* =================================
   حماية النصوص
================================= */

function escapeHtml(
  value
) {

  return String(
    value ?? ''
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}


/* =================================
   إرسال المشاركة
================================= */

async function submitParticipation(
  event
) {

  event.preventDefault();
  event.stopPropagation();

  if (isSubmitting) {
    return;
  }

  const form =
    event.currentTarget;

  if (!form) {
    return;
  }

  if (!supabaseClient) {
    showStatus(
      'الاتصال بخدمة المشاركة غير جاهز. حاول تحديث الصفحة.',
      'error'
    );

    return;
  }

  const fd =
    new FormData(form);

  /* =================================
     قراءة البيانات الأساسية
  ================================= */

  const file =
    fd.get('media') ||
    getFileInput()?.files?.[0] ||
    null;

  const name =
    String(
      fd.get('name') || ''
    ).trim();

  const category =
    String(
      fd.get('category') || ''
    ).trim();

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

  /* =================================
     التحقق من البيانات الأساسية
     الملف اختياري
  ================================= */

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

  /* =================================
     التحقق من الملف فقط إذا تم اختياره
  ================================= */

  let selectedFile = null;
  let mediaType = null;
  let storagePath = null;
  const submissionId =
    crypto.randomUUID();

  if (
    file &&
    file instanceof File &&
    file.size > 0
  ) {

    selectedFile = file;

    if (
      !ALLOWED_TYPES.has(
        selectedFile.type
      )
    ) {

      showStatus(
        'نوع الملف غير مسموح. اختر صورة أو فيديو مدعومًا.',
        'error'
      );

      return;
    }

    if (
      selectedFile.size >
      MAX_FILE_SIZE
    ) {

      showStatus(
        'حجم الملف يتجاوز 25 MB.',
        'error'
      );

      return;
    }

    mediaType =
      selectedFile.type.startsWith(
        'video/'
      )
        ? 'video'
        : 'image';

    storagePath =
      `${submissionId}/${mediaType}/${sanitizeFileName(selectedFile.name)}`;
  }

  const title =
    `${labels[category]} - مشاركة اليوم الوطني`;

  setSubmitting(
    true
  );

  showStatus(
    selectedFile
      ? 'جارٍ رفع المشاركة…'
      : 'جارٍ تسجيل المشاركة النصية…',
    'info'
  );

  try {

    /* =================================
       رفع الملف — فقط إذا اختاره المستخدم
    ================================= */

    if (selectedFile && storagePath) {

      const {
        error: uploadError
      } =
        await supabaseClient.storage
          .from('submissions')
          .upload(
            storagePath,
            selectedFile,
            {
              cacheControl:
                '3600',
              contentType:
                selectedFile.type,
              upsert:
                false
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
    }

    /* =================================
       تسجيل المشاركة في قاعدة البيانات
    ================================= */

    const safeGrade =
      grade ||
      'غير محدد';

    const {
      error: insertError
    } =
      await supabaseClient
        .from('submissions')
        .insert({
          id:
            submissionId,
          student_name:
            name,
          grade:
            safeGrade,
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

      /* ---------------------------------
         تنظيف الملف إذا تم رفعه ثم فشل الإدخال
      --------------------------------- */

      if (selectedFile && storagePath) {

        try {

          await supabaseClient.storage
            .from('submissions')
            .remove([
              storagePath
            ]);

        } catch (
          cleanupError
        ) {

          console.error(
            'STORAGE CLEANUP ERROR:',
            cleanupError
          );
        }
      }

      throw new Error(
        `تعذر تسجيل المشاركة: ${insertError.message}`
      );
    }

    /* =================================
       نجاح الإرسال
    ================================= */

    console.log(
      'SUBMISSION SUCCESS:',
      submissionId,
      selectedFile
        ? 'media'
        : 'text'
    );

    form.reset();

    hideStatus();

    closeModal();

    showSuccessMessage();

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

    setSubmitting(
      false
    );
  }
}


/* =================================
   تجهيز الواجهة
================================= */

function setupInterface() {

  const form =
    getForm();


  if (form) {

    /* الملف اختياري: لا نسمح لـ HTML required بمنع الإرسال النصي */
    const fileInput =
      getFileInput();

    if (fileInput) {
      fileInput.required = false;
      fileInput.removeAttribute('required');
    }

    form.addEventListener(
      'submit',
      submitParticipation
    );
  }


  /* =================================
     البحث
  ================================= */

  const search =
    document.getElementById(
      'search'
    );


  if (search) {

    search.addEventListener(
      'input',
      function () {

        render();
      }
    );
  }


  /* =================================
     أزرار التصنيف
  ================================= */

  document
    .querySelectorAll(
      '[data-filter]'
    )
    .forEach(
      function (button) {

        button.addEventListener(
          'click',
          function () {

            currentFilter =
              button.dataset.filter ||
              'all';


            document
              .querySelectorAll(
                '[data-filter]'
              )
              .forEach(
                function (item) {

                  item.classList.remove(
                    'active'
                  );
                }
              );


            button.classList.add(
              'active'
            );


            render();
          }
        );
      }
    );


  /* =================================
     ESC
  ================================= */

  document.addEventListener(
    'keydown',
    function (event) {

      if (
        event.key ===
        'Escape'
      ) {

        closeModal();
      }
    }
  );
}


/* =================================
   بدء التطبيق
================================= */

async function startApp() {

  setupInterface();


  const loaded =
    loadSupabase();


  if (!loaded) {

    console.error(
      'Supabase could not be initialized.'
    );

    return;
  }


  await loadSubmissions();
}


/* =================================
   الدوال العامة
================================= */

window.openModal =
  openModal;

window.closeModal =
  closeModal;

window.render =
  render;


/* =================================
   تشغيل التطبيق
================================= */

startApp();
