define([
    'jquery',
    'underscore',
    'backbone',
    'tap/TapAPI',
    'tap/views/BaseView',
    'tap/TemplateManager'
], function($, _, Backbone, TapAPI, BaseView, TemplateManager) {
    var headerView = BaseView.extend({
        attributes: {
            'data-role': 'header',
            'data-position': 'fixed'
        },
        template: TemplateManager.get('header'),
        initialize: function() {
            this.listenTo(Backbone, 'tap.router.routed', this.render);
        },
        render: function(view) {
            this.$el.html(this.template({title: 'blah'}));
            return this;
        }
    });
    return headerView;
});