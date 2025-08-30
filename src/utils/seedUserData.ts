import { supabase } from '../services/supabase';
// Adjust the import below to match your static movie list export
// If you have a JSON version of the list, use this import:
// import movieList from '../assets/TSPDT100-C0EFDFkb.json';

// If you only have the JS file, you can import it dynamically:
let movieList: any[] = [];
try {
  // @ts-ignore
  movieList = (await import('../assets/TSPDT100-C0EFDFkb.js')).default || [];
} catch (e) {
  console.error('Could not load movie list asset:', e);
}

export async function seedUserData(userId: string) {
  // Check if user already has lists
  const { data: existingLists, error } = await supabase
    .from('lists')
    .select('id')
    .eq('user_id', userId);

  if (error) {
    console.error('Error checking for existing lists:', error);
    return;
  }
  if (existingLists && existingLists.length > 0) return; // Already seeded

  // Insert static lists for this user
  for (const list of movieList) {
    const { error: insertError } = await supabase.from('lists').insert({
      ...list,
      user_id: userId,
    });
    if (insertError) {
      console.error(`Failed to insert list: ${list.title}`, insertError);
    }
  }
}
