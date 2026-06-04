const { createClient } = require('@supabase/supabase-js');
const url = 'https://jiuxpadzesuprzhnxxik.supabase.co';
const anonKey = 'sb_publishable_SIE2_AeDvxHF4IoQpThIMg_VkW6evwB';

const supabase = createClient(url, anonKey);

async function test() {
  try {
    // Find a valid user
    const { data: users } = await supabase.from('users').select('id').limit(1);
    if (!users || users.length === 0) {
      console.log('No users found in database!');
      return;
    }
    const staffId = users[0].id;

    // 1. Create a dummy transaction
    const { data: tx, error: txErr } = await supabase.from('transactions').insert([{
      invoice_number: 'TEST-' + Date.now(),
      staff_id: staffId,
      total_amount: 1000,
      payment_method: 'cash'
    }]).select();
    
    if (txErr) {
      console.log('Tx insert error:', txErr);
      return;
    }
    
    console.log('Tx inserted:', tx);
    
    // Try to insert a transaction item with product_id as null
    const { data: item, error: itemErr } = await supabase.from('transaction_items').insert([{
      transaction_id: tx[0].id,
      product_id: null,
      quantity: 1,
      price_at_sale: 1000
    }]).select();
    
    console.log('Item with product_id: null result:', { data: item, error: itemErr });

    // Clean up
    await supabase.from('transactions').delete().eq('id', tx[0].id);
  } catch (err) {
    console.error(err);
  }
}

test();
