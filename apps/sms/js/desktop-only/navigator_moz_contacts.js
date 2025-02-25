/*global Utils, Promise */

'use strict';

/* ***********************************************************

  Code below is for desktop testing!

  Adapted from:

  https://mxr.mozilla.org/mozilla-b2g18/source/dom/contacts/fallback/ContactDB.jsm
  https://mxr.mozilla.org/mozilla-b2g18/source/dom/contacts/ContactManager.js
  apps/sms/js/contacts.js


*********************************************************** */
(function(window) {
  function getAsset(filename) {
    return new Promise(function(resolve, reject) {
      var req = new XMLHttpRequest();
      req.open('GET', filename, true);
      req.responseType = 'blob';
      req.onload = function() {
        resolve(req.response);
      };
      req.send();
    });
  }

  function stringOrBust(aObj) {
    if (typeof aObj !== 'string') {
      return undefined;
    } else {
      return aObj;
    }
  }

  function sanitizeStringArray(aArray) {
    if (!Array.isArray(aArray)) {
      aArray = [aArray];
    }
    return aArray.map(stringOrBust).filter(function(el) {
      return el !== undefined;
    });
  }

  function _isVanillaObj(aObj) {
    return Object.prototype.toString.call(aObj) == '[object Object]';
  }

  function Normalize(opts) {
    opts.fields.forEach(function(field) {
      var value = opts.record[field.name];

      this[field.name] = typeof value !== 'undefined' ?
        field.filter(value) : null;
    }, this);
  }

  function ContactField(field) {
    Normalize.call(this, {
      fields: [
        { name: 'type', filter: sanitize },
        { name: 'value', filter: stringOrBust }
      ],
      record: field
    });
  }

  function ContactTelField(tel) {
    Normalize.call(this, {
      fields: [
        { name: 'type', filter: sanitize },
        { name: 'value', filter: stringOrBust },
        { name: 'carrier', filter: stringOrBust }
      ],
      record: tel
    });
  }

  function ContactAddress(address) {
    Normalize.call(this, {
      fields: [
        { name: 'type', filter: sanitize },
        { name: 'streetAddress', filter: stringOrBust },
        { name: 'locality', filter: stringOrBust },
        { name: 'region', filter: stringOrBust },
        { name: 'postalCode', filter: stringOrBust },
        { name: 'countryName', filter: stringOrBust }
      ],
      record: address
    });
  }

  function multiValue(source, ctor) {
    var result = [];
    source = Array.isArray(source) ? source : [source];

    for (var entry of source) {
      if (_isVanillaObj(entry)) {
        result.push(new ctor(entry));
      }
    }
    return result;
  }

  function Contact(contact) {
    Normalize.call(this, {
      fields: [
        { name: 'name', filter: sanitize },
        { name: 'honorificPrefix', filter: sanitize },
        { name: 'honorificSuffix', filter: sanitize },
        { name: 'givenName', filter: sanitize },
        { name: 'additionalName', filter: sanitize },
        { name: 'familyName', filter: sanitize },
        { name: 'nickname', filter: sanitize },
        { name: 'email', filter: sanitize },
        { name: 'photo', filter: sanitize },
        { name: 'url', filter: sanitize },
        { name: 'category', filter: sanitize },
        { name: 'org', filter: sanitize },
        { name: 'jobTitle', filter: sanitize },
        { name: 'note', filter: sanitize },
        { name: 'impp', filter: sanitize }
      ],
      record: contact
    });

    this.id = ++cid;

    this.name = [
      this.givenName[0] + ' ' + this.familyName[0]
    ];

    this.email = typeof contact.email !== 'undefined' ?
      multiValue(contact.email, ContactField) : null;

    this.adr = typeof contact.adr !== 'undefined' ?
      multiValue(contact.adr, ContactAddress) : null;

    this.tel = typeof contact.tel !== 'undefined' ?
      multiValue(contact.tel, ContactTelField) : null;

    this.url = typeof contact.url !== 'undefined' ?
      multiValue(contact.url, ContactField) : null;

    this.bday = typeof contact.bday !== 'undefined' ?
      new Date(contact.bday) : null;

    this.anniversary = contact.anniversary ?
      new Date(contact.anniversary) : null;
  }

  var ContactsDB = [];
  var sanitize = sanitizeStringArray;
  var cid = 0;
  var methods = {
    contains: 'startsWith',
    match: 'contains',
    equals: 'contains'
  };

  function isMatch(contact, filter) {
    /**
     * Validation Strategy
     *
     * 1. Let _found_ be a register of confirmed terms
     * 2. Let _contact_ be a contact record.
     * 3. For each _term_ [...input list], with the label _outer_
     *   - For each _field_ of [givenName, familyName]
     *     - For each _value_ in _contact_[ _field_ ]
     *       - Let _found_[ _term_ ] be the result of calling
     *           _value_.startsWith( _term_ )
     *         - If _found_[ _term_ ] is **true**, continue to
     *           loop labelled _outer_
     * 4. If every value of _key_ in _found_ is **true** return **true**,
     *    else return **false**
    */
    var found = {};
    var method = methods[filter.filterOp];
    var term = filter.filterValue.toLowerCase();

    // The outer loop is specifically labelled to allow the
    // nested condition a way out of the second and third loop.
    outer:
    for (var field of filter.filterBy) {
      if (!contact[field]) {
         continue;
      }
      for (var value of contact[field]) {
        if (typeof value !== 'string') {
          value = value.value;
        }
        if ((found[term] = value.toLowerCase()[method](term))) {
          return true;
        }

        if (field === 'tel') {
          if (Utils.probablyMatches(value, term)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // // Do not use the native API.
  navigator.mozContacts = {
    addEventListener: function(type, handler, capture) {
      return this;
    },
    find: function(filter) {
      // attribute DOMString     filterValue;    // e.g. 'Tom'
      // attribute DOMString     filterOp;       // e.g. 'contains'
      // attribute DOMString[]   filterBy;       // e.g. 'givenName'
      // attribute DOMString     sortBy;         // e.g. 'givenName'
      // attribute DOMString     sortOrder;      // e.g. 'descending'
      // attribute unsigned long filterLimit;

      // Implement a mock that gives results that appear to
      // match the real behaviour of filtered contacts results
      var result = ContactsDB.filter(function(contact) {
        return isMatch(contact, filter);
      });

      return readyPromise.then(() => result);
    }
  };


  ContactsDB.push(
    new Contact({
      familyName: 'Turing',
      givenName: 'Alan',
      tel: {
        value: '101',
        type: 'Mobile',
        carrier: 'Telco'
      }
    })
  );

  /**
   // 102 is omitted intentionally.

   ContactsDB.push(
    new Contact({
      familyName: '',
      givenName: '',
      tel: {
        value: '102'
      }
    })
  );
  */

  ContactsDB.push(
    new Contact({
      familyName: 'Shannon',
      givenName: 'Claude',
      tel: {
        value: '103',
        type: 'Mobile'
      }
    })
  );

  ContactsDB.push(
    new Contact({
      familyName: 'Lovelace',
      givenName: 'Ada',
      tel: {
        value: '104'
      },
      email: {
        value: 'ada@lovelace.com'
      }
    })
  );

  ContactsDB.push(
    new Contact({
      familyName: 'Tesla',
      givenName: 'Nikola',
      email: {
        value: 'nikola@tesla.com'
      }
    })
  );

  ContactsDB.push(
    new Contact({
      familyName: 'Babbage',
      givenName: 'Charles',
      tel: {
        value: '105'
      }
    })
  );

  ContactsDB.push(
    new Contact({
      familyName: 'Backus',
      givenName: 'John',
      tel: {
        value: '106'
      }
    })
  );

  ContactsDB.push(
    new Contact({
      familyName: 'McCarthy',
      givenName: 'John',
      tel: {
        value: '107'
      }
    })
  );

  ContactsDB.push(
    new Contact({
      familyName: 'Steele',
      givenName: 'Guy',
      tel: {
        value: '108'
      }
    })
  );

  ContactsDB.push(
    new Contact({
      familyName: 'Kay',
      givenName: 'Alan',
      tel: {
        value: '109',
        type: 'Mobile',
        carrier: 'Nynex'
      }
    })
  );


  var grace = new Contact({
    familyName: 'Hopper',
    givenName: 'Grace',
    tel: {
      value: '999'
    }
  });

  var tom = new Contact({
    familyName: 'O\'Hare',
    givenName: 'Tom',
    tel: {
      value: '123456',
      type: 'Mobile',
      carrier: 'Nynex'
    }
  });

  var longname = new Contact({
    familyName: 'Taumatawhakatangihangakoauauota',
    givenName: 'Mateapokaiwhenuakitanatahu',
    tel: [{
        value: '+18001114321',
          type: ['Mobile']
    }]
  });

  var rtlName = new Contact({
    familyName: 'الخيام',
    givenName: 'عمر',
    tel: [{
        value: '+97121111111',
        type: ['Mobile'],
        carrier: 'اتصالات'
    }]
  });

  var readyPromise = Promise.all([
    getAsset('/js/desktop-only/assets/photo-man.jpg'),
    getAsset('/js/desktop-only/assets/photo-woman.jpg'),
    getAsset('/js/desktop-only/assets/photo-man-bowtie.jpg')
  ]).then(function gotall(blobs) {
    tom.photo = [blobs[0]];
    grace.photo = [blobs[1]];
    longname.photo = [blobs[2]];
  });

  ContactsDB.push(grace);
  ContactsDB.push(tom);
  ContactsDB.push(longname);
  ContactsDB.push(rtlName);

  ContactsDB.push(
    new Contact({
      familyName: 'Carrier',
      givenName: 'Igotno',
      tel: {
        value: '436797',
        type: 'Mobile',
        carrier: null
      }
    })
  );

  ContactsDB.push(
    new Contact({
      familyName: 'Jekyll',
      givenName: 'Doctor',
      tel: [
        {
          value: '+12125551234',
          type: ['Mobile']
        },
        {
          value: '+15551237890',
          type: ['Home']
        }
      ]
    })
  );

  ContactsDB.push(
    new Contact({
      familyName: 'Non-digit',
      givenName: 'Multiple',
      tel: [
        {
          value: '900-BUY-A-CAR',
          type: ['Mobile'],
          carrier: 'Megaphones'
        },
        {
          value: '800-BUY-A-CAR',
          type: ['Home'],
          carrier: 'Nynex'
        }
      ]
    })
  );

  ContactsDB.push(
    new Contact({
      familyName: '',
      givenName: 'Bob',
      tel: [
        {
          value: '555-666-1234',
          type: ['Mobile'],
          carrier: 'ScamCo'
        }
      ]
    })
  );

  // console.log( ContactsDB );




}(window));
