import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL  = 'https://avcqqazytvvcfraowgsm.supabase.co';
const SUPABASE_ANON = 'sb_publishable_mMzC6t1szSIzhhYZpHOhkA_4oYbwgc0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const avatarUrl = session.user?.user_metadata?.avatar_url;
  if (!avatarUrl) return;

  const icon = document.querySelector('.nav-player-icon');
  if (!icon) return;

  icon.textContent = '';
  const img = document.createElement('img');
  img.src = avatarUrl;
  img.alt = 'Profile';
  img.className = 'nav-avatar-img';
  icon.appendChild(img);
})();
