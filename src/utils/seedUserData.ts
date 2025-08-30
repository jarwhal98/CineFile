
import { supabase } from '../services/supabase';
import movieList from '../assets/TSPDT100.json';

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
