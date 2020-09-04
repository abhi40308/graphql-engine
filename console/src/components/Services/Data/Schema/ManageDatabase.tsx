import React from 'react';
import Helmet from 'react-helmet';
import { Connect } from 'react-redux';

import Button from '../../../Common/Button/Button';
import styles from '../../../Common/Common.scss';
import { ReduxState } from '../../../../types';
import { Schema } from '../../../../dataSources/types';
import BreadCrumb from '../../../Common/Layout/BreadCrumb/BreadCrumb';
import DatabaseCreator from './DatabaseCreator';

type DatabaseDetails = {
  name: string;
  type: 'postgres' | 'mysql';
  url: string;
};

type ManageDatabaseProps = {
  schemaList: Schema[]; // this is just a dummy prop
};

type DatabaseListItemProps = {
  handleRemove: () => void;
  handleReload: () => void;
  dbDetails: DatabaseDetails;
};

const dummyData: DatabaseListItemProps[] = [
  {
    handleRemove: () => {},
    handleReload: () => {},
    dbDetails: { name: 'myDb', type: 'postgres', url: 'something' },
  },
  {
    handleRemove: () => {},
    handleReload: () => {},
    dbDetails: { name: 'dbdbdbdb', type: 'mysql', url: 'someLink' },
  },
];

const DatabaseListItem: React.FC<DatabaseListItemProps> = ({
  handleReload,
  handleRemove,
  dbDetails,
}) => (
  <div className={styles.db_list_item}>
    <Button size='xs' color='white' onClick={handleReload}>
      Reload
    </Button>
    <Button
      className={styles.db_list_content}
      size='xs'
      color='white'
      onClick={handleRemove}
    >
      Remove
    </Button>
    <div className={styles.db_list_content}>
      <b>
        {dbDetails.name} ({dbDetails.type})
      </b>{' '}
      - {dbDetails.url}
    </div>
  </div>
);

const crumbs = [
  {
    title: 'Data',
    url: '/data',
  },
  {
    title: 'Manage',
    url: '#',
  },
];

const ManageDatabase: React.FC<ManageDatabaseProps> = () => {
  const dataList = dummyData.map(data => <DatabaseListItem {...data} />);
  const databaseTypes = ['postgres', 'mysql'];

  return (
    <div
      className={`container-fluid ${styles.padd_left_remove} ${styles.padd_top} ${styles.manage_dbs_page}`}
    >
      <div className={styles.padd_left}>
        <Helmet title='Manage - Data | Hasura' />
        <BreadCrumb breadCrumbs={crumbs} />
        <div className={styles.display_flex}>
          <h2 className={`${styles.headerText} ${styles.display_inline}`}>
            Manage Databases
          </h2>
          <Button color='yellow' size='md' className={styles.add_mar_left}>
            Add Database
          </Button>
        </div>
        <div className={styles.manage_db_content}>
          <hr />
          <h3 className={`${styles.heading_text} ${styles.remove_pad_bottom}`}>
            Databases
          </h3>
          <div className={styles.data_list_container}>{dataList}</div>
          <hr />
        </div>
        <DatabaseCreator databaseTypes={databaseTypes} />
      </div>
    </div>
  );
};

const mapStateToProps = (state: ReduxState) => {
  return {
    schemaList: state.tables.schemaList,
  };
};

const manageConnector = (connect: Connect) =>
  connect(mapStateToProps)(ManageDatabase);

export default manageConnector;
