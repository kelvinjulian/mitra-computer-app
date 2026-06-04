const { createClient } = require('@supabase/supabase-js');
const url = 'https://jiuxpadzesuprzhnxxik.supabase.co';
const anonKey = 'sb_publishable_SIE2_AeDvxHF4IoQpThIMg_VkW6evwB';

const supabase = createClient(url, anonKey);

async function check() {
  try {
    const { data: prods } = await supabase.from('products').select('*');
    console.log('Products in DB:', prods);
  } catch (err) {
    console.error(err);
  }
}

check();
