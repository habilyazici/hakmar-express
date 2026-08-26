import { useQueryClient } from '@tanstack/react-query';
import type {
  AdminUserDto,
  ChangeOwnPasswordBody,
  CreateUserBody,
  Page,
  SetPasswordBody,
  UpdateUserBody,
} from '@hakmar/contracts';
import { apiClient } from '../../lib/api-client';
import { useApiQuery } from '../../lib/query';
import type { ResourceDef } from './resource-types';

/**
 * Every request the Yönetim and Kullanıcılar screens make.
 *
 * The mutations are plain async functions rather than hooks: what happens on
 * success is form state (close the dialog, clear the field, show the error
 * next to the right input), which belongs to the component. Only the URLs,
 * the cache keys and the invalidation live here.
 */

const PAGE_SIZE = 25;

// ---------------------------------------------------------------- resources

export type ResourceRow = Record<string, unknown>;
export type ResourceValues = Record<string, unknown>;

export function useResourceList(
  resource: ResourceDef,
  offset: number,
  search: string,
) {
  return useApiQuery<Page<ResourceRow>>(
    [resource.key, 'list', offset, search],
    resource.endpoint,
    { limit: PAGE_SIZE, offset, search: search || undefined },
  );
}

export function useInvalidateResource(resource: ResourceDef) {
  const queryClient = useQueryClient();
  return () => {
    // The reference dropdowns in other forms read the same endpoint, so the
    // whole resource's cache goes, not just this page of it.
    void queryClient.invalidateQueries({ queryKey: [resource.key] });
    void queryClient.invalidateQueries({ queryKey: ['ref', resource.endpoint] });
  };
}

export function createResource(resource: ResourceDef, payload: ResourceValues) {
  return apiClient.post(resource.endpoint, payload);
}

export function updateResource(
  resource: ResourceDef,
  id: unknown,
  payload: ResourceValues,
) {
  return apiClient.patch(`${resource.endpoint}/${String(id)}`, payload);
}

export function deleteResource(resource: ResourceDef, id: unknown) {
  return apiClient.delete(`${resource.endpoint}/${String(id)}`);
}

export { PAGE_SIZE };

// -------------------------------------------------------------------- users

export function useUsers(enabled: boolean) {
  return useApiQuery<Page<AdminUserDto>>(
    ['users', 'list'],
    '/users',
    { limit: 200 },
    enabled,
  );
}

export function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['users'] });
}

export function createUser(body: CreateUserBody) {
  return apiClient.post('/users', body);
}

export function updateUser(id: number, body: UpdateUserBody) {
  return apiClient.patch(`/users/${id}`, body);
}

export function deleteUser(id: number) {
  return apiClient.delete(`/users/${id}`);
}

export function setUserPassword(id: number, password: string) {
  const body: SetPasswordBody = { password };
  return apiClient.patch(`/users/${id}/password`, body);
}

export function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
) {
  const body: ChangeOwnPasswordBody = { currentPassword, newPassword };
  return apiClient.patch('/users/me/password', body);
}
