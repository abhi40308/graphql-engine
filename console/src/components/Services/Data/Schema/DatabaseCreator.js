import React, { useState } from 'react';
import ExpandableEditor from '../../../Common/Layout/ExpandableEditor/Editor';
import SearchableSelect from '../../../Common/SearchableSelect/SearchableSelect';
import styles from '../../../Common/Common.scss';

const useColumnEditor = () => {
  const initialState = {
    dbName: '',
    dbType: '',
    dbUrl: '',
  };

  const [databaseState, setDatabaseState] = useState(initialState);
  const { dbName, dbType, dbUrl } = databaseState;

  const onSubmit = () => {
    // TODO
  };

  return {
    dbName: {
      value: dbName,
      onChange: e => {
        setDatabaseState({ ...databaseState, dbName: e.target.value });
      },
    },
    dbType: {
      value: dbType,
      onChange: selected => {
        setDatabaseState({ ...databaseState, dbType: selected.value });
      },
    },
    dbUrl: {
      value: dbUrl,
      onChange: e => {
        setDatabaseState({ ...databaseState, dbUrl: e.target.value });
      },
    },
    onSubmit,
  };
};

const DatabaseCreator = ({ databaseTypes }) => {
  const { dbName, dbType, dbUrl, onSubmit } = useColumnEditor();

  const getDatabaseTypeInput = () => {
    const customSelectBoxStyles = {
      container: {
        width: '186px',
      },
      dropdownIndicator: {
        padding: '5px',
      },
      placeholder: {
        top: '44%',
        fontSize: '12px',
      },
      singleValue: {
        fontSize: '12px',
        top: '44%',
        color: '#555555',
      },
    };

    return (
      <span className={styles.add_mar_right_mid} data-test='db-type-0'>
        <SearchableSelect
          options={databaseTypes}
          onChange={dbType.onChange}
          value={dbType.value}
          bsClass={'database-select'}
          styleOverrides={customSelectBoxStyles}
          filterOption='prefix'
          placeholder='database_type'
        />
      </span>
    );
  };

  const getDatabaseNameInput = () => {
    return (
      <input
        placeholder='database name'
        type='text'
        className={`${styles.add_mar_right_mid} input-sm form-control`}
        data-test='database-name'
        {...dbName}
      />
    );
  };

  const getDatabaseUrlInput = () => {
    return (
      <input
        placeholder='database url'
        type='url'
        className={`${styles.add_mar_right_mid} input-sm form-control`}
        data-test='database-url'
        {...dbUrl}
      />
    );
  };

  const expandedContent = () => (
    <div>
      <form className={`form-inline ${styles.display_flex}`}>
        {getDatabaseTypeInput()}
        {getDatabaseNameInput()}
        {getDatabaseUrlInput()}
      </form>
    </div>
  );

  return (
    <ExpandableEditor
      editorExpanded={expandedContent}
      property={'add-new-database'}
      expandButtonText={'Add database'}
      saveFunc={onSubmit}
      isCollapsable
    />
  );
};

export default DatabaseCreator;
