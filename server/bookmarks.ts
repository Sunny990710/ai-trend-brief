import type { Response } from 'express';
import type { AuthRequest } from './auth.js';
import { supabase } from './supabase.js';

export async function getBookmarks(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;

  const { data, error } = await supabase
    .from('bookmarks').select('item_id').eq('user_id', userId);

  if (error) {
    res.status(500).json({ error: '북마크 조회 실패' });
    return;
  }

  res.json({ itemIds: (data || []).map(b => b.item_id) });
}

export async function addBookmark(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { itemId } = req.body;

  if (!itemId) {
    res.status(400).json({ error: 'itemId가 필요합니다.' });
    return;
  }

  const { error } = await supabase
    .from('bookmarks').insert({ user_id: userId, item_id: itemId });

  if (error) {
    if (error.code === '23505') {
      res.json({ message: '이미 북마크되어 있습니다.', itemId });
      return;
    }
    res.status(500).json({ error: '북마크 추가 실패' });
    return;
  }

  res.status(201).json({ message: '북마크 추가 완료', itemId });
}

export async function removeBookmark(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { itemId } = req.params;

  const { data, error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .select();

  if (error) {
    res.status(500).json({ error: '북마크 삭제 실패' });
    return;
  }

  if (!data || data.length === 0) {
    res.status(404).json({ error: '해당 북마크를 찾을 수 없습니다.' });
    return;
  }

  res.json({ message: '북마크 삭제 완료', itemId });
}
