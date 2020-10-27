import { findRemoteSchemaPermission } from '../utils';

export const getCreateRemoteSchemaPermissionQuery = (
  def: { role: string; filter: any },
  remoteSchemaName: string,
  schemaDefinition: any
) => {
  return {
    type: 'add_remote_schema_permissions',
    args: {
      remote_schema: remoteSchemaName,
      role: def.role,
      definition: {
        schema: schemaDefinition.sdl,
      },
    },
  };
};

export const getDropRemoteSchemaPermissionQuery = (
  role: string,
  remoteSchemaName: string
) => {
  return {
    type: 'drop_remote_schema_permissions',
    args: {
      remote_schema: remoteSchemaName,
      role,
    },
  };
};

// TODO
export const getRemoteSchemaPermissionQueries = (
  permissionEdit,
  allPermissions,
  remoteSchemaName,
  schemaDefinition
) => {
  const { role, newRole, filter } = permissionEdit;

  const upQueries = [];
  const downQueries = [];

  const permRole = (newRole || role).trim();

  const existingPerm = findRemoteSchemaPermission(allPermissions, permRole);

  if (newRole || (!newRole && !existingPerm)) {
    upQueries.push(
      getCreateRemoteSchemaPermissionQuery(
        {
          role: permRole,
          filter,
        },
        remoteSchemaName,
        schemaDefinition
      )
    );
    downQueries.push(
      getDropRemoteSchemaPermissionQuery(permRole, remoteSchemaName)
    );
  }

  if (existingPerm) {
    upQueries.push(
      getDropRemoteSchemaPermissionQuery(permRole, remoteSchemaName)
    );
    upQueries.push(
      getCreateRemoteSchemaPermissionQuery(
        { role: permRole, filter },
        remoteSchemaName,
        schemaDefinition
      )
    );
    downQueries.push(
      getDropRemoteSchemaPermissionQuery(permRole, remoteSchemaName)
    );
    upQueries.push(
      getCreateRemoteSchemaPermissionQuery(
        { role: permRole, filter: existingPerm.definition.select.filter },
        remoteSchemaName,
        schemaDefinition
      )
    );
  }

  return {
    upQueries,
    downQueries,
  };
};

export const updateBulkSelect = (bulkSelect, selectedRole, isAdd) => {
  let bulkRes = bulkSelect;
  if (isAdd) {
    bulkRes.push(selectedRole);
  } else {
    bulkRes = bulkRes.filter(e => e !== selectedRole);
  }
  return bulkRes;
};
