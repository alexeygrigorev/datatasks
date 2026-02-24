(function () {
  'use strict';

  var JSON_HEADERS = { 'Content-Type': 'application/json' };

  function handleResponse(response) {
    if (!response.ok) {
      return response.text().then(function (text) {
        var msg;
        try {
          var parsed = JSON.parse(text);
          msg = parsed.error || response.statusText;
        } catch (e) {
          msg = response.statusText || 'Request failed';
        }
        throw new Error(msg);
      });
    }
    if (response.status === 204) {
      return null;
    }
    return response.json();
  }

  window.api = {
    tasks: {
      list: function (params) {
        var qs = new URLSearchParams(params || {}).toString();
        return fetch('/api/tasks' + (qs ? '?' + qs : '')).then(handleResponse);
      },
      get: function (id) {
        return fetch('/api/tasks/' + id).then(handleResponse);
      },
      create: function (data) {
        return fetch('/api/tasks', {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify(data),
        }).then(handleResponse);
      },
      update: function (id, data) {
        return fetch('/api/tasks/' + id, {
          method: 'PUT',
          headers: JSON_HEADERS,
          body: JSON.stringify(data),
        }).then(handleResponse);
      },
      delete: function (id) {
        return fetch('/api/tasks/' + id, { method: 'DELETE' }).then(handleResponse);
      },
    },

    bundles: {
      list: function () {
        return fetch('/api/bundles').then(handleResponse);
      },
      get: function (id) {
        return fetch('/api/bundles/' + id).then(handleResponse);
      },
      create: function (data) {
        return fetch('/api/bundles', {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify(data),
        }).then(handleResponse);
      },
      update: function (id, data) {
        return fetch('/api/bundles/' + id, {
          method: 'PUT',
          headers: JSON_HEADERS,
          body: JSON.stringify(data),
        }).then(handleResponse);
      },
      delete: function (id) {
        return fetch('/api/bundles/' + id, { method: 'DELETE' }).then(handleResponse);
      },
      tasks: function (id) {
        return fetch('/api/bundles/' + id + '/tasks').then(handleResponse);
      },
    },

    templates: {
      list: function () {
        return fetch('/api/templates').then(handleResponse);
      },
      get: function (id) {
        return fetch('/api/templates/' + id).then(handleResponse);
      },
      create: function (data) {
        return fetch('/api/templates', {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify(data),
        }).then(handleResponse);
      },
      update: function (id, data) {
        return fetch('/api/templates/' + id, {
          method: 'PUT',
          headers: JSON_HEADERS,
          body: JSON.stringify(data),
        }).then(handleResponse);
      },
      delete: function (id) {
        return fetch('/api/templates/' + id, { method: 'DELETE' }).then(handleResponse);
      },
    },

    recurring: {
      list: function () {
        return fetch('/api/recurring').then(handleResponse);
      },
      get: function (id) {
        return fetch('/api/recurring/' + id).then(handleResponse);
      },
      create: function (data) {
        return fetch('/api/recurring', {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify(data),
        }).then(handleResponse);
      },
      update: function (id, data) {
        return fetch('/api/recurring/' + id, {
          method: 'PUT',
          headers: JSON_HEADERS,
          body: JSON.stringify(data),
        }).then(handleResponse);
      },
      delete: function (id) {
        return fetch('/api/recurring/' + id, { method: 'DELETE' }).then(handleResponse);
      },
      generate: function (data) {
        return fetch('/api/recurring/generate', {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify(data),
        }).then(handleResponse);
      },
    },
  };
})();
