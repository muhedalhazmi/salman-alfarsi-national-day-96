const SUPABASE_URL = 'https://sargzcxvmfwgttnshqzo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_MaYiH9mSbYqxp-zFN5_YZw_hdcllh_w';

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

const MAX_FILE_SIZE = 25 * 1024 * 1024;

let supabase;
let data = [];
let filter = 'all';
let signedUrls = new Map();

const $ = id => document.getElementById(id);

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m])
  );
}

function showStatus(message, type = 'info') {
  let el = $('formStatus');

  if (!el) {
    el = document.createElement('div');
    el.id = 'formStatus';
    el.className = 'form-status';
    const form = $('form');
    if (form) form.appendChild(el);
  }

  el.textContent = message;
  el.className = `form-status ${type}`;
}

function setSubmitting(value) {
  const button = $('submitButton');

  if (!button) return;

  button.disabled = value;
  button.textContent = value
    ? 'جارٍ رفع المشاركة…'
    : 'إرسال للمراجعة ↗';
}

function getFileInput() {
  return document.querySelector(
    '#form input[type="file"]'
  );
}

function prepareForm() {
  const form = $('form');

  if (!form) return;

  const fileInput = getFileInput();

  if (fileInput) {
    fileInput.name = 'media';
    fileInput.accept =
      'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime';
  }

  if (!$('submitButton')) {
    const button =
      form.querySelector('button[type="submit"]');

    if (button) {
      button.id = 'submitButton';
      button.textContent = 'إرسال للمراجعة ↗';
    }
  }

  if (!$('formStatus')) {
    const status = document.createElement('div');
    status.id = 'formStatus';
    status.className = 'form-status';
    form.appendChild(status);
  }

  if (!form.querySelector('input[name="consent"]')) {
    const wrapper = document.createElement('label');

    wrapper.className = 'consent';

    wrapper.innerHTML = `
      <input
        type="checkbox"
        name="consent"
        required
      >
      <span>
        أقرّ بأن لدي موافقة ولي الأمر على نشر المشاركة،
        وأوافق على مراجعتها قبل عرضها في الحائط الوطني.
      </span>
    `;

    const submitButton =
      $('submitButton');

    if (submitButton) {
      form.insertBefore(wrapper, submitButton);
    } else {
      form.appendChild(wrapper);
    }
  }

  const note = document.createElement('div');

  note.style.cssText =
    'font-size:13px;text-align:center;margin-top:8px;opacity:.75;';

  note.textContent =
    'ستظهر المشاركة بعد اعتماد الإدارة. الحد الأقصى للملف 25 MB.';

  if (
    !form.querySelector(
      '[data-upload-note]'
    )
  ) {
    note.dataset.uploadNote = 'true';
    form.appendChild(note);
  }
}

async function loadSupabase() {
  if (window.supabase) {
    supabase = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );

    return;
  }

  await new Promise((resolve, reject) => {
    const script = document.createElement('script');

    script.src =
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

    script.onload = resolve;
    script.onerror = reject;

    document.head.appendChild(script);
  });

  supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );
}

async function loadSubmissions() {
  if (!supabase) return;

  const {
    data: rows,
    error
  } = await supabase
    .from('submissions')
    .select(
      'id,student_name,grade,title,description,media_type,storage_path,status,submitted_at'
    )
    .eq('status', 'approved')
    .order('submitted_at', {
      ascending: false
    })
    .limit(100);

  if (error) {
    console.error(error);
    data = [];
    render();
    return;
  }

  data = (rows || []).map(row => ({
    id: row.id,
    name: row.student_name,
    category:
      row.title?.includes('ولي أمر')
        ? 'parent'
        : row.title?.includes('كادر')
        ? 'staff'
        : row.title?.includes('مجتمع')
        ? 'community'
        : 'student',
    grade: row.grade || '',
    message: row.description || '',
    featured: false,
    mediaType: row.media_type,
    storagePath: row.storage_path,
    submittedAt: row.submitted_at
  }));

  signedUrls = new Map();

  const paths = data
    .map(item => item.storagePath)
    .filter(Boolean);

  if (paths.length) {
    const {
      data: signed,
      error: signedError
    } = await supabase.storage
      .from('submissions')
      .createSignedUrls(paths, 3600);

    if (!signedError && signed) {
      signed.forEach(item => {
        if (item.path && item.signedUrl) {
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

function render() {
  const search = $('search');

  const q = (
    search?.value || ''
  )
    .trim()
    .toLowerCase();

  const visible = data.filter(item =>
    (filter === 'all' ||
      item.category === filter) &&
    (
      !q ||
      `${item.name} ${item.message} ${item.grade}`
        .toLowerCase()
        .includes(q)
    )
  );

  if ($('total')) {
    $('total').textContent = data.length;
  }

  if ($('students')) {
    $('students').textContent =
      data.filter(
        x => x.category === 'student'
      ).length;
  }

  if ($('parents')) {
    $('parents').textContent =
      data.filter(
        x => x.category === 'parent'
      ).length;
  }

  if ($('featured')) {
    $('featured').textContent =
      data.filter(x => x.featured).length;
  }

  if (!$('wallGrid')) return;

  $('wallGrid').innerHTML =
    visible.map(item => {

      const url =
        signedUrls.get(
          item.storagePath
        );

      let visual =
        '<div class="visual">🇸🇦</div>';

      if (url) {
        if (
          item.mediaType === 'video'
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
                ${esc(labels[item.category] || 'مشاركة')}
              </span>

              <span>✓ معتمدة</span>
            </div>

            <p>
              ${esc(item.message)}
            </p>

            <div class="meta">
              <strong>
                ${esc(item.name)}
              </strong>

              <span>
                ${esc(item.grade)}
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

function openModal(category) {
  const modal = $('modal');

  if (!modal) return;

  modal.classList.add('show');
  modal.setAttribute(
    'aria-hidden',
    'false'
  );

  if (
    category &&
    $('category')
  ) {
    $('category').value = category;
  }

  setTimeout(() => {
    const input =
      $('form')?.querySelector(
        'input[name="name"]'
      );

    if (input) input.focus();
  }, 50);
}

function closeModal() {
  const modal = $('modal');

  if (!modal) return;

  modal.classList.remove('show');

  modal.setAttribute(
    'aria-hidden',
    'true'
  );

  if ($('formStatus')) {
    $('formStatus').textContent = '';
    $('formStatus').className =
      'form-status';
  }
}

function sanitizeFileName(name) {
  const ext =
    name.includes('.')
      ? name
          .split('.')
          .pop()
          .toLowerCase()
      : 'bin';

  const base = name
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/\.[^.]+$/, '');

  const safe = base
    .replace(
      /[^a-zA-Z0-9_-]+/g,
      '-'
    )
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) ||
    'submission';

  return `${safe}-${Date.now()}.${ext}`;
}

async function submitParticipation(event) {
  event.preventDefault();

  const form =
    event.currentTarget;

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
    !file ||
    !(file instanceof File)
  ) {
    showStatus(
      'اختر ملف المشاركة أولًا.',
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
      'نوع الملف غير مسموح. اختر صورة أو فيديو بصيغة مدعومة.',
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

  if (
    !name ||
    !message ||
    !consent ||
    !labels[category]
  ) {
    showStatus(
      'أكمل البيانات المطلوبة ووافق على الإقرار.',
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
    'جارٍ رفع الملف بأمان…',
    'info'
  );

  try {

    const {
      error: uploadError
    } = await supabase.storage
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
        uploadError
      );

      throw new Error(
        'تعذر رفع الملف. حاول مرة أخرى.'
      );
    }

    showStatus(
      'تم رفع الملف، جارٍ تسجيل المشاركة…',
      'info'
    );

    const {
      error: insertError
    } = await supabase
      .from('submissions')
      .insert({
        id: submissionId,
        student_name: name,
        grade: grade || null,
        title: title,
        description: message,
        media_type: mediaType,
        storage_path: storagePath,
        guardian_consent: true,
        status: 'pending'
      });

    if (insertError) {
      console.error(
        insertError
      );

      throw new Error(
        'تم رفع الملف لكن تعذر تسجيل المشاركة.'
      );
    }

    form.reset();

    closeModal();

    alert(
      'تم استلام مشاركتك بنجاح، وستظهر بعد اعتماد الإدارة.'
    );

    location.hash = 'wall';

    await loadSubmissions();

  } catch (error) {

    console.error(error);

    showStatus(
      error.message ||
      'حدث خطأ غير متوقع.',
      'error'
    );

  } finally {

    setSubmitting(false);

  }
}

async function startApp() {

  prepareForm();

  await loadSupabase();

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
            .forEach(item =>
              item.classList.remove(
                'active'
              )
            );

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

  if ($('form')) {
    $('form').addEventListener(
      'submit',
      submitParticipation
    );
  }

  if ($('modal')) {
    $('modal').addEventListener(
      'keydown',
      event => {
        if (
          event.key === 'Escape'
        ) {
          closeModal();
        }
      }
    );
  }

  await loadSubmissions();
}

startApp();