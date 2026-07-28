const SUPABASE_URL = 'https://avcqqazytvvcfraowgsm.supabase.co';
const SUPABASE_ANON = 'sb_publishable_mMzC6t1szSIzhhYZpHOhkA_4oYbwgc0';

const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

function redirectTo(target) {
  window.location.replace(target);
}

try {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session || !session.user || !session.user.email) {
    redirectTo('community.html');
  } else {
    const userEmail = session.user.email.trim().toLowerCase();
    const { data: adminCheck } = await supabase
      .from('admin_users')
      .select('id')
      .ilike('email', userEmail)
      .maybeSingle();

    if (!adminCheck || !adminCheck.id) {
      redirectTo('index.html');
    } else {
      document.body.classList.remove('admin-protected');
    }
  }
} catch {
  redirectTo('index.html');
}