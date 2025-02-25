define(function(require) {
  'use strict';

  var SettingsPanel = require('modules/settings_panel');
  var AddonManager = require('modules/addon_manager');
  var AddonDetails = require('panels/addon_details/addon_details');
  var SettingsService = require('modules/settings_service');
  var Toaster = require('shared/toaster');

  return function ctor_addon_details_panel() {
    return SettingsPanel({
      onInit: function(panel) {
        this._elements = {
          body: panel.querySelector('.addon-details-body'),
          header: panel.querySelector('.addon-details-header'),
          icon: panel.querySelector('.addon-details-icon'),
          description: panel.querySelector('.addon-description-text'),
          developer: panel.querySelector('.addon-developer'),
          targetsList: panel.querySelector('.addon-targets'),
          noTargetsMsg: panel.querySelector('.addon-no-targets'),
          toggle: panel.querySelector('.addon-enabled'),
          deleteButton: panel.querySelector('.addon-delete')
        };
        this._details = AddonDetails(this._elements);
        this._boundOnAppEnabledChange = this._onAppEnabledChange.bind(this);

        // Hook up the enable/disable toggle button
        this._elements.toggle.onchange = this._onToggleChange.bind(this);
        // Hook up the delete button
        this._elements.deleteButton.onclick = this._onDelete.bind(this);
      },

      onBeforeShow: function(panel, options) {
        this._curAddon = options.addon;

        // set initial state
        this._details.render(this._curAddon);
        this._elements.toggle.checked = AddonManager.isEnabled(this._curAddon);
        this._curAddon.observe('enabled', this._boundOnAppEnabledChange);
        this._elements.deleteButton.disabled =
          !AddonManager.canDelete(this._curAddon);
      },

      onHide: function() {
        // Scroll back to the top
        this._elements.body.scrollTop = 0;

        this._curAddon.unobserve('enabled', this._boundOnAppEnabledChange);
        this._curAddon = null;
      },

      _onAppEnabledChange: function(enabled) {
        this._elements.toggle.checked = enabled;
        if (!enabled) {
          AddonManager.getAddonDisableType(this._curAddon).then((type) => {
            // If an addon injected a script then we have to restart any
            // affected apps. And if those apps are system apps, then we
            // need to reboot the device.
            if (type === 'reboot') {
              // XXX We could do a confirm dialog here asking the user if
              // they want to go ahead and reboot the device now.
              Toaster.showToast({
                messageL10nId: 'addon-reboot-required',
                latency: 3000,
                useTransition: true
              });
            } else if (type === 'restart') {
              Toaster.showToast({
                messageL10nId: 'addon-restart-apps-to-disable',
                latency: 3000,
                useTransition: true
              });
            }
          });
        }
      },

      _onToggleChange: function() {
        if (this._elements.toggle.checked) {
          AddonManager.enableAddon(this._curAddon);
        } else {
          AddonManager.disableAddon(this._curAddon);
        }
      },

      _onDelete: function() {
        this._elements.deleteButton.disabled = true; // don't delete it twice!
        AddonManager.deleteAddon(this._curAddon).then(() => {
          SettingsService.navigate('addons');  // go back
        }, (reason) => {
          console.error('Addon deletion failed:', reason);
          // If the user cancelled deletion, we need to reenable the button
          this._elements.deleteButton.disabled = false;
        });
      }
    });
  };
});
