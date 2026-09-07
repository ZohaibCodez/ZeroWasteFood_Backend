require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function main() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('Error listing buckets:', error);
    process.exit(1);
  }

  const exists = buckets.find(b => b.name === 'food-images');
  if (!exists) {
    console.log('Creating "food-images" bucket...');
    const { error: createError } = await supabase.storage.createBucket('food-images', {
      public: true, // Make sure it's public so URLs work!
      fileSizeLimit: 5242880, // 5MB
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp']
    });
    
    if (createError) {
      console.error('Failed to create bucket:', createError);
      process.exit(1);
    }
    console.log('Bucket "food-images" created successfully.');
  } else {
    console.log('Bucket "food-images" already exists.');
    
    // Attempt to update it to be public if it wasn't
    const { error: updateError } = await supabase.storage.updateBucket('food-images', {
      public: true,
      fileSizeLimit: 5242880,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp']
    });
    
    if (updateError) {
      console.log('Could not update bucket settings (might already be fine):', updateError.message);
    } else {
      console.log('Bucket "food-images" updated to be public.');
    }
  }
}

main();
