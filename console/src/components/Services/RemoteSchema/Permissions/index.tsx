import React from 'react';
import { connect } from 'react-redux';
import Permissions from './Permissions';
import RemoteSchemaContainer from '../Containers/remoteSchemaContainer';
import {
  permRemoveMultipleRoles,
  VIEW_REMOTE_SCHEMA,
  saveRemoteSchemaPermission,
  removeRemoteSchemaPermission,
} from '../Actions';
import {
  permCloseEdit,
  setSchemaDefinition,
  setDefaults,
  permOpenEdit,
  permSetRoleName,
  permSetBulkSelect,
} from './reducer';
import { fetchRoleList } from '../../Data/DataActions';
import { PermWrapperProps } from './types';
import { Dispatch, ReduxState } from '../../../../types';

const PermWrapper: React.FC<PermWrapperProps> = ({
  allRoles,
  allRemoteSchemas,
  ...props
}) => {
  const { params, viewRemoteSchema } = props;
  return (
    <RemoteSchemaContainer
      params={params}
      allRemoteSchemas={allRemoteSchemas}
      tabName="permissions"
      viewRemoteSchema={viewRemoteSchema}
    >
      <Permissions allRoles={allRoles} {...props} />
    </RemoteSchemaContainer>
  );
};

const mapStateToProps = (state: ReduxState) => {
  return {
    ...state.remoteSchemas.permissions,
    allRoles: state.tables.allRoles,
    allRemoteSchemas: state.remoteSchemas.listData.remoteSchemas,
    readOnlyMode: state.main.readOnlyMode,
  };
};

const mapDispatchToProps = (dispatch: Dispatch) => {
  return {
    dispatch,
    permRemoveMultipleRoles: () => dispatch(permRemoveMultipleRoles()),
    viewRemoteSchema: (data: string) =>
      dispatch({ type: VIEW_REMOTE_SCHEMA, data }),
    saveRemoteSchemaPermission: (data: any) =>
      dispatch(saveRemoteSchemaPermission(data)),
    removeRemoteSchemaPermission: (data: any) =>
      dispatch(removeRemoteSchemaPermission(data)),
    setSchemaDefinition: (data: string) => dispatch(setSchemaDefinition(data)),
    fetchRoleList: () => dispatch(fetchRoleList()),
    setDefaults: () => dispatch(setDefaults()),
    permCloseEdit: () => dispatch(permCloseEdit()),
    permOpenEdit: (role: string, newRole: boolean, existingPerms: boolean) =>
      dispatch(permOpenEdit(role, newRole, existingPerms)),
    permSetBulkSelect: (checked: boolean, role: string) =>
      dispatch(permSetBulkSelect(checked, role)),
    permSetRoleName: (name: string) => dispatch(permSetRoleName(name)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(PermWrapper);
