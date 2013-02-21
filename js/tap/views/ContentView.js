define([
    'jquery',
    'underscore',
    'backbone',
    'tap/views/BaseView',
    'tap/TemplateManager'
], function($, _, Backbone, BaseView, TemplateManager) {
    var contentView = BaseView.extend({
        id: 'content-wrapper',
        attributes: {
            'data-role': 'content'
        },
        initialize: function() {
            this.currentView = undefined;
            this.listenTo(Backbone, 'tap.router.routed', this.render);
        },
        render: function(view) {
            if (view === undefined) return this;
this.$el.removeAttr('style');
            // cleanup previous view
            if (this.currentView !== undefined) {
                this.$el.removeClass(this.currentView.id);
                this.currentView.close();
            }
            // set current view
            this.currentView = view;
            // add the new view
            this.$el.addClass(view.id);
            this.$el.html(view.render().$el);
            view.finishedAddingContent();

            return this;
        }
    });
    return contentView;
});