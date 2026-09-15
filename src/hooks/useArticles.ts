import { useState, useEffect, useCallback } from 'react';
import type { Article } from '../data/portfolioData';
import { fetchPublishedArticles } from '../services/articleService';

export function useArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadArticles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchPublishedArticles();
      setArticles(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('获取文章列表失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchPublishedArticles()
      .then((data) => {
        if (active) {
          setArticles(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err : new Error('获取文章列表失败'));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return { articles, loading, error, refresh: loadArticles };
}
