require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRealtime() {
  console.log('1. Setting up realtime listener on food_listings...');
  
  let eventReceived = false;

  const channel = supabase.channel('test-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'food_listings' }, (payload) => {
      console.log('✅ Realtime event received! Notification feature is WORKING.');
      eventReceived = true;
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log('2. Successfully subscribed. Waiting 1s before inserting dummy data...');
        
        setTimeout(async () => {
          console.log('3. Inserting dummy food listing...');
          const { data, error } = await supabase.from('food_listings').insert([{
            restaurant_id: 'e3b0c442-989b-464c-8693-5183868019aa',
            title: 'Test Notification Food',
            quantity: 1,
            food_type: 'vegan',
            lat: 31.5204,
            lng: 74.3587,
            expiry_time: new Date(Date.now() + 100000).toISOString(),
            status: 'available'
          }]).select();

          if (error) {
            console.error('Failed to insert:', error);
            process.exit(1);
          }
          
          console.log('4. Insert successful. Waiting for Realtime event...');

          // Wait 2 seconds for event to arrive
          setTimeout(async () => {
             // Cleanup
             await supabase.from('food_listings').delete().eq('id', data[0].id);
             console.log('5. Cleaned up dummy data.');
             
             if (!eventReceived) {
                console.log('❌ Did not receive realtime event. You must enable Realtime in Supabase Dashboard -> Database -> Publications -> supabase_realtime -> Check food_listings.');
             }
             process.exit(0);
          }, 2000);

        }, 1000);
      }
    });
}

testRealtime();
