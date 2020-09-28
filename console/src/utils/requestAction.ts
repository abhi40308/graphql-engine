import { push } from 'react-router-redux';
import globals from '../Globals';
import { Thunk } from '../types';
import dataHeaders from '../components/Services/Data/Common/Headers';

import {
  LOAD_REQUEST,
  DONE_REQUEST,
  FAILED_REQUEST,
  ERROR_REQUEST,
  CONNECTION_FAILED,
} from '../components/App/Actions';
import { globalCookiePolicy } from '../Endpoints';

const requestAction = (
  url: string,
  options: RequestInit = {},
  SUCCESS?: string,
  ERROR?: string,
  includeCredentials = true,
  includeAdminHeaders = false
): Thunk<Promise<any>> => {
  return (dispatch: any, getState: any) => {
    const requestOptions = { ...options };

    if (!options.credentials && includeCredentials) {
      requestOptions.credentials = globalCookiePolicy;
    }

    if (includeAdminHeaders) {
      requestOptions.headers = {
        ...(options.headers || {}),
        ...dataHeaders(getState),
      };
    }
    return new Promise((resolve, reject) => {
      dispatch({ type: LOAD_REQUEST });
      fetch(url, requestOptions).then(
        response => {
          if (response.ok) {
            return response.json().then(results => {
              if (SUCCESS) {
                dispatch({ type: SUCCESS, data: results });
              }
              dispatch({ type: DONE_REQUEST });
              resolve(results);
            });
          }

          if (response.status >= 400 && response.status <= 500) {
            let isResponseJSON = true;
            const responseContentType = response.headers.get('Content-Type');
            if (responseContentType?.includes('text')) {
              isResponseJSON = false;
            }

            if (!isResponseJSON) {
              return response.text().then(errorMsg => {
                dispatch({ type: FAILED_REQUEST });
                if (ERROR) {
                  dispatch({ type: ERROR, response, data: errorMsg });
                }
                // a bool to check whether loading screen is shown, and based on this call error request
                reject();
              });
            }

            return response.json().then(errorMsg => {
              dispatch({ type: FAILED_REQUEST });
              const msg = errorMsg;
              if (ERROR) {
                dispatch({ type: ERROR, data: msg });
              } else {
                dispatch({
                  type: ERROR_REQUEST,
                  data: msg,
                  url,
                  params: options.body,
                  statusCode: response.status,
                });
              }
              if (msg.code && msg.code === 'access-denied') {
                if (window.location.pathname !== `${globals.urlPrefix}/login`) {
                  dispatch(push(`${globals.urlPrefix}/login`));
                }
              }
              reject(msg);
            });
          }
        },
        error => {
          console.error('Request error: ', error);
          dispatch({ type: CONNECTION_FAILED });
          if (ERROR) {
            dispatch({
              type: ERROR,
              message: error.message,
              data: error.message,
            });
          }
          reject(error);
        }
      );
    });
  };
};

export default requestAction;
