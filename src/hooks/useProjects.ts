import { useState, useEffect, useCallback } from 'react';
import type { Project } from '../data/portfolioData';
import { fetchPublishedProjects } from '../services/projectService';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchPublishedProjects();
      setProjects(data);
      setError(null);
    } catch (err) {
      setProjects([]);
      setError(err instanceof Error ? err : new Error('获取项目列表失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchPublishedProjects()
      .then((data) => {
        if (active) {
          setProjects(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err : new Error('获取项目列表失败'));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return { projects, loading, error, refresh: loadProjects };
}
