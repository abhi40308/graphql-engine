import React, { useEffect, useState } from 'react';
import * as GQL from 'graphql';
import {
  generateSDL,
  generateConstantTypes,
  getArgTreeFromPermissionSDL,
} from './utils';
import Button from '../../../Common/Button/Button';
import styles from '../../../Common/Permissions/PermissionStyles.scss';
import { DatasourceObject, FieldType, PermissionEditorProps } from './types';
import { PermissionEditorContext } from './context';
import Tree from './Tree';



const PermissionEditor: React.FC<PermissionEditorProps> = ({ ...props }) => {
  const {
    permissionEdit,
    isEditing,
    isFetching,
    schemaDefinition,
    permCloseEdit,
    saveRemoteSchemaPermission,
    removeRemoteSchemaPermission,
    setSchemaDefinition,
    datasource,
    schema,
  } = props;

  const [state, setState] = useState<DatasourceObject[]>(datasource); // TODO - low priority:  a copy of datasource, could be able to remove this after evaluation
  const [argTree, setArgTree] = useState({}); // all @presets as an object tree
  const [resultString, setResultString] = useState(''); // Generated SDL

  const { isNewRole, isNewPerm } = permissionEdit;

  useEffect(() => {
    window.SCHEMA = schema;
    window.GQL = GQL;

    console.log('changed--->', state);
    if (!state) return;
    setResultString(generateSDL(state, argTree));
    // setSchemaDefinition(resultString);
  }, [state, argTree]);

  useEffect(() => {
    setState(datasource);
    setResultString(schemaDefinition);
  }, [datasource]);

  useEffect(() => {
    if (!!schemaDefinition) {
      try {
        const newArgTree = getArgTreeFromPermissionSDL(schemaDefinition);
        setArgTree(newArgTree);
      } catch (e) {
        console.error(e);
      }
    }
  }, [schemaDefinition]);

  if (!isEditing) return null;

  const buttonStyle = styles.add_mar_right;

  const closeEditor = () => {
    permCloseEdit();
  };

  const save = () => {
    saveRemoteSchemaPermission(closeEditor);
  };

  const saveFunc = () => {
    const finalString = resultString + generateConstantTypes(schema);
    setSchemaDefinition(finalString);
    save();
  };

  const removeFunc = () => {
    removeRemoteSchemaPermission(closeEditor);
  };

  return (
    <div className={styles.activeEdit}>
      <div className={styles.tree}>
        <PermissionEditorContext.Provider value={{ argTree, setArgTree }}>
          <Tree list={state as FieldType[]} setState={setState} />
          {/* <code style={{ whiteSpace: 'pre-wrap' }}>{resultString}</code> */}
        </PermissionEditorContext.Provider>
      </div>
      <Button
        onClick={saveFunc}
        color="yellow"
        className={buttonStyle}
        disabled={isFetching}
      >
        Save Permissions
      </Button>
      {!(isNewRole || isNewPerm) && (
        <Button
          onClick={removeFunc}
          color="red"
          className={buttonStyle}
          disabled={isFetching}
        >
          Remove Permissions
        </Button>
      )}
      <Button color="white" className={buttonStyle} onClick={closeEditor}>
        Cancel
      </Button>
    </div>
  );
};

export default React.memo(PermissionEditor);
