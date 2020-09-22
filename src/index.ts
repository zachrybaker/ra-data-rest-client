import { stringify } from "query-string";
import { fetchUtils, DataProvider } from "ra-core";

/**
 * Based on https://github.com/marmelab/react-admin/master/packages/ra-data-simple-rest
 * but extended to support non-'id' identifier names.
 *
 * Maps react-admin queries to a simple REST API
 *
 * This REST dialect is similar to the one of FakeRest
 *
 * @see https://github.com/marmelab/FakeRest
 *
 * @example
 *
 * getList     => GET http://my.api.url/posts?sort=['title','ASC']&range=[0, 24]
 * getOne      => GET http://my.api.url/posts/123
 * getMany     => GET http://my.api.url/posts?filter={id:[123,456,789]}
 * update      => PUT http://my.api.url/posts/123
 * create      => POST http://my.api.url/posts
 * delete      => DELETE http://my.api.url/posts/123
 *
 * @example
 *
 * import * as React from "react";
 * import { Admin, Resource } from 'react-admin';
 * import restProvider from 'ra-data-rest-client';
 *
 * import { PostList } from './posts';
 *
 * const App = () => (
 *     <Admin dataProvider={restProvider('http://path.to.my.api/', {'posts':'key'})}>
 *         <Resource name="posts" list={PostList} />
 *     </Admin>
 * );
 *
 * export default App;
 */
const _reKeyResponse = (json: any, key: string) => {
  if (key === null) {
    return json;
  } else if (Array.isArray(json)) {
    return;
    json.map((x) => {
      x.id = x[key];
      delete x[key];
      return x;
    });
  } else if (json[key] !== null) {
    json.id = json[key];
    delete json[key];
    return json;
  } else {
    console.error("undhandled scenario of _reKeyResponse", key, json);
  }
};
const _reKeyPayload = (data: any, reParam: string) => {
  var reData =
    reParam === null
      ? data
      : {
          ...data,
        };
  if (reParam !== null) {
    reData[reParam] = reData.id;
    delete reData.id;
  }
  return reData;
};

export default (
  apiUrl: string,
  keysByResource: any = {} /* ex: {'posts':'key',...} */,
  httpClient = fetchUtils.fetchJson,
  countHeader: string = "Content-Range"
): DataProvider => ({
  keysByResource: keysByResource,
  getList: (resource, params) => {
    const reParam =
      resource in keysByResource ? keysByResource[resource] : null;
    const { page, perPage } = params.pagination;
    let { field, order } = params.sort;
    let reFilter =
      params.filter === null
        ? null
        : {
            ...params.filter,
          };

    if (reParam != null) {
      if (field === "id") {
        field = reParam;
      }
      if (reFilter !== null && "id" in reFilter) {
        reFilter[reParam] = params.filter.id;
        delete reFilter.id;
      }
    }

    const rangeStart = (page - 1) * perPage;
    const rangeEnd = page * perPage - 1;

    const query = {
      sort: JSON.stringify([field, order]),
      range: JSON.stringify([rangeStart, rangeEnd]),
      filter: JSON.stringify(reFilter),
    };
    const url = `${apiUrl}/${resource}?${stringify(query)}`;
    const options =
      countHeader === "Content-Range"
        ? {
            // Chrome doesn't return `Content-Range` header if no `Range` is provided in the request.
            headers: new Headers({
              Range: `${resource}=${rangeStart}-${rangeEnd}`,
            }),
          }
        : {};

    return httpClient(url, options).then(({ headers, json }) => {
      if (!headers.has(countHeader)) {
        throw new Error(
          `The ${countHeader} header is missing in the HTTP Response. The simple REST data provider expects responses for lists of resources to contain this header with the total number of results to build the pagination. If you are using CORS, did you declare ${countHeader} in the Access-Control-Expose-Headers header?`
        );
      }
      return {
        data: _reKeyResponse(json, reParam),
        total:
          countHeader === "Content-Range"
            ? parseInt(headers.get("content-range").split("/").pop(), 10)
            : parseInt(headers.get(countHeader.toLowerCase())),
      };
    });
  },

  getOne: (resource, params) => {
    const reParam =
      resource in keysByResource ? keysByResource[resource] : null;

    return httpClient(`${apiUrl}/${resource}/${params.id}`).then(
      ({ json }) => ({
        data: _reKeyResponse(json, reParam),
      })
    );
  },

  getMany: (resource, params) => {
    const reParam =
      resource in keysByResource ? keysByResource[resource] : null;
    var q = {};
    q[reParam ?? "id"] = params.ids;
    const query = {
      filter: JSON.stringify(q),
    };
    const url = `${apiUrl}/${resource}?${stringify(query)}`;
    return httpClient(url).then(({ json }) => ({
      data: _reKeyResponse(json, reParam),
    }));
  },

  getManyReference: (resource, params) => {
    const reParam =
      resource in keysByResource ? keysByResource[resource] : null;
    const { page, perPage } = params.pagination;
    var { field, order } = params.sort;
    let reFilter =
      params.filter === null
        ? null
        : {
            ...params.filter,
          };

    if (reParam != null) {
      if (field === "id") {
        field = reParam;
      }
      if (reFilter !== null && "id" in reFilter) {
        reFilter[reParam] = params.filter.id;
        delete reFilter.id;
      }
    }
    const rangeStart = (page - 1) * perPage;
    const rangeEnd = page * perPage - 1;

    const query = {
      sort: JSON.stringify([field, order]),
      range: JSON.stringify([(page - 1) * perPage, page * perPage - 1]),
      filter: JSON.stringify({
        ...reFilter,
        [params.target]: params.id,
      }),
    };
    const url = `${apiUrl}/${resource}?${stringify(query)}`;
    const options =
      countHeader === "Content-Range"
        ? {
            // Chrome doesn't return `Content-Range` header if no `Range` is provided in the request.
            headers: new Headers({
              Range: `${resource}=${rangeStart}-${rangeEnd}`,
            }),
          }
        : {};

    return httpClient(url, options).then(({ headers, json }) => {
      if (!headers.has(countHeader)) {
        throw new Error(
          `The ${countHeader} header is missing in the HTTP Response. The simple REST data provider expects responses for lists of resources to contain this header with the total number of results to build the pagination. If you are using CORS, did you declare ${countHeader} in the Access-Control-Expose-Headers header?`
        );
      }
      return {
        data: _reKeyResponse(json, reParam),
        total:
          countHeader === "Content-Range"
            ? parseInt(headers.get("content-range").split("/").pop(), 10)
            : parseInt(headers.get(countHeader.toLowerCase())),
      };
    });
  },

  update: (resource, params) => {
    const reParam =
      resource in keysByResource ? keysByResource[resource] : null;
    const reData = _reKeyPayload(params.data, reParam);
    return httpClient(`${apiUrl}/${resource}/${params.id}`, {
      method: "PUT",
      body: JSON.stringify(reData),
    }).then(({ json }) => ({ data: _reKeyResponse(json, reParam) }));
  },

  // simple-rest doesn't handle provide an updateMany route, so we fallback to calling update n times instead
  updateMany: (resource, params) => {
    const reParam =
      resource in keysByResource ? keysByResource[resource] : null;
    const idKey = reParam ?? "id";
    return Promise.all(
      params.ids.map((id) => {
        const reData = _reKeyPayload(params.data, reParam);
        return httpClient(`${apiUrl}/${resource}/${id}`, {
          method: "PUT",
          body: JSON.stringify(reData),
        });
      })
    ).then((responses) => ({ data: responses.map(({ json }) => json[idKey]) }));
  },

  create: (resource, params) => {
    const reParam =
      resource in keysByResource ? keysByResource[resource] : null;
    const reData = _reKeyPayload(params.data, reParam);
    const idKey = reParam ?? "id";
    return httpClient(`${apiUrl}/${resource}`, {
      method: "POST",
      body: JSON.stringify(reData),
    }).then(({ json }) => ({
      data: { ...params.data, id: json[idKey] },
    }));
  },

  delete: (resource, params) => {
    const reParam =
      resource in keysByResource ? keysByResource[resource] : null;
    return httpClient(`${apiUrl}/${resource}/${params.id}`, {
      method: "DELETE",
    }).then(({ json }) => ({ data: _reKeyResponse(json, reParam) }));
  },

  // simple-rest doesn't handle filters on DELETE route, so we fallback to calling DELETE n times instead
  deleteMany: (resource, params) => {
    const reParam =
      resource in keysByResource ? keysByResource[resource] : null;
    const idKey = reParam ?? "id";
    return Promise.all(
      params.ids.map((id) =>
        httpClient(`${apiUrl}/${resource}/${id}`, {
          method: "DELETE",
        })
      )
    ).then((responses) => ({ data: responses.map(({ json }) => json[idKey]) }));
  },
});
