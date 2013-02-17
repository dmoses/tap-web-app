define([
    'jquery',
    'underscore',
    'backbone',
    'tap/TapAPI',
    'tap/TemplateManager',
    'tap/views/BaseView',
    'leaflet'
], function($, _, Backbone, TapAPI, TemplateManager, BaseView) {
    var mapView = BaseView.extend({
        id: 'tour-map',
        //template: TemplateManager.get('tour-map'),
        initialize: function() {
            this.map = null;
            this.stop_markers = {};
            this.stop_icons = {};
            this.stop_popups = {};
            this.stop_bounds = null;
            this.position_marker = null;
            this.view_initialized = false;

            this.location_icon = L.divIcon({
                className: 'location-icon'
            });

            this.stop_icon = L.divIcon({
                className: 'stop-icon'
            });


            // // Look to see if a location is defined for the tour to use as the initial map center
            // var tour = TapAPI.tours.get(TapAPI.currentTour);
            // _.each(tour.get('appResource'), function(resource) {

            //     // Make sure this is a geo asset reference
            //     if ((resource === undefined) || (resource.usage != 'geo')) return;

            //     asset = TapAPI.tourAssets.get(resource.id);
            //     var content = asset.get('content');
            //     if (content === undefined) return;
            //     var data = $.parseJSON(content.at(0).get('data'));

            //     if (data.type == 'Point') {
            //         map_options['init-lon'] = data.coordinates[0];
            //         map_options['init-lat'] = data.coordinates[1];
            //     }
            // });

            // // Look to see if the initial map zoom level is set
            // _.each(tour.get('propertySet').models, function(property) {
            //     if (property.get('name') == 'initial_map_zoom') {
            //         map_options['init-zoom'] = property.get('value');
            //     }
            // });

            _.defaults(this.options, {
                'init-lat': null,
                'init-lon': null,
                'init-zoom': 2
            });
            $(window).on('orientationchange resize', this.resizeContentArea);
        },
        render: function() {
            this.resizeContentArea();
            return this;
        },
        finishedAddingContent: function() {
            //TapAPI.geoLocation.startLocating();

            var map = L.map('tour-map', {
                continuousWorld: true
            }).setView([53.9618, 58.4277], 13);
            L.tileLayer('http://{s}.tile.osmosnimki.ru/kosmo/{z}/{x}/{y}.png', {
                attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
                maxZoom: 18,
                minZoom: 4,
                detectRetina: true
            }).addTo(map);
        },
        initMap: function() {
            // Add the stop markers
            _.each(this.options['stops'].models, this.plotTourStopMarker, this);
            TapAPI.geoLocation.active_stop_collection = this.options['stops'];

            // Determine the bounding region
            _.each(this.stop_markers, function(marker) {

                var l = marker.getLatLng();
                if (this.stop_bounds === null) {
                    this.stop_bounds = new L.LatLngBounds(l,l);
                } else {
                    this.stop_bounds.extend(l);
                }

            }, this);

            // Set the viewport based on settings
            if ((this.options['init-lat'] === null) || (this.options['init-lon'] === null)) {
                if (this.stop_bounds !== null) {
                    this.map.fitBounds(this.stop_bounds);
                } else {
                    this.map.setView(L.latLng(0,0), this.options['init-zoom']);
                }
            } else {
                this.map.setView(
                    new L.LatLng(this.options['init-lat'], this.options['init-lon']),
                    this.options['init-zoom']
                );
            }

            // At this point the stop markers should be added to the map
            // We can augment them with the distance labels
            _.each(this.options['stops'].models, function(stop) {
                TapAPI.tours.selectTour(stop.get('tour'));
                if (stop.getAssetsByUsage('geo') === undefined) return;
                this.updateStopMarker(stop);
            }, this);

            if (TapAPI.geoLocation.latest_location !== null) {
                this.onLocationFound(TapAPI.geoLocation.latest_location);
            }
            TapAPI.geoLocation.on("gotlocation", this.onLocationFound, this);

            return this;
        },
        generateBubbleContent: function(stop, formatted_distance) {
            if (formatted_distance === undefined) {
                if (stop.get('distance')) {
                    formatted_distance = TapAPI.geoLocation.formatDistance(stop.get('distance'));
                }
            }

            var template = TapAPI.templateManager.get('tour-map-marker-bubble');
            return template({
                'title': stop.get('title'),
                'tour_id': stop.get('tour'),
                'stop_id': stop.get('id'),
                'distance': (formatted_distance === undefined) ? '' : 'Distance: ' + formatted_distance,
                'stop_lat': stop.get('location').lat,
                'stop_lon': stop.get('location').lng
            });

        },
        // Plot a single tour stop marker on the map
        // @note Assumes that the context is set to { stop: (StopModel), map_view: (MapView) }
        plotTourStopMarker: function(stop) {
            // Make sure the proper tour is active
            TapAPI.tours.selectTour(stop.get('tour'));

            // Find the geo assets for this stop
            var geo_assets = stop.getAssetsByUsage('geo');
            if (geo_assets === undefined) return;

            // Parse the contents of the first geo asset
            var content = geo_assets[0].get('content');
            if (content === undefined) return;
            var data = $.parseJSON(content.at(0).get('data'));

            if (data.type == 'Point') {

                var stop_icon = L.divIcon({
                    className: 'stop-icon ' + stop.id
                });

                var marker_location = new L.LatLng(data.coordinates[1], data.coordinates[0]);
                var marker = new L.Marker(marker_location, { icon: stop_icon });

                var popup = new L.Popup();
                popup.setLatLng(marker_location);
                popup.setContent(this.generateBubbleContent(stop));
                this.stop_popups[stop.id] = popup;

                marker.stop_id = stop.id;
                marker.addEventListener('click', this.onMarkerSelected, this);

                this.stop_icons[stop.id] = stop_icon;
                this.stop_markers[stop.id] = marker;
                this.map.addLayer(marker);

            }

            // Update the marker bubble when the distance to a stop changes
            stop.on('change:distance', this.updateStopMarker, this);

        },


        updateStopMarker: function(stop) {
            var formatted_distance;

            if (stop.get('distance')) {
                formatted_distance = TapAPI.geoLocation.formatDistance(stop.get('distance'));
            }

            this.stop_popups[stop.id].setContent(this.generateBubbleContent(stop), formatted_distance);

            // Update the stop icon
            var distance_label = $('.stop-icon.' + stop.id + ' .distance-label');

            if (distance_label.length === 0) {
                template = TapAPI.templateManager.get('tour-map-distance-label');
                $('.stop-icon.' + stop.id).append(template({
                    distance: formatted_distance
                }));
            } else {
                distance_label.html(formatted_distance);
            }

        },
        // When a marker is selected, show the popup
        // Assumes that the context is set to (MapView)
        onMarkerSelected: function(e) {
            TapAPI.gaq.push(['_trackEvent', 'Map', 'marker_clicked', e.target.stop_id]);

            this.map.openPopup(this.stop_popups[e.target.stop_id]);

            $('.marker-bubble-content .directions a').on('click', function() {
                TapAPI.gaq.push(['_trackEvent', 'Map', 'get_directions', e.target.stop_id]);
            });

        },
        onLocationFound: function(position) {
            //console.log('onLocationFound', position);
            var latlng = new L.LatLng(position.coords.latitude, position.coords.longitude);

            if (this.position_marker === null) {

                this.position_marker = new L.Marker(latlng, {icon: this.location_icon});
                this.position_marker.bindPopup('You are here');
                this.map.addLayer(this.position_marker);

                this.position_marker.addEventListener('click', function() {
                    TapAPI.gaq.push(['_trackEvent', 'Map', 'you_are_here_clicked']);
                });

            } else {

                this.position_marker.setLatLng(latlng);

            }

        },
        onLocationError: function(e) {
            console.log('onLocationError', e);
            // TODO: hide the position marker?

        },
        resizeContentArea: function() {
            var footer, header, viewport;
            window.scroll(0, 0);

            viewport = $(window).height();
            header = 42;
            footer = 37;

            $('#content-wrapper').height(viewport - header - footer);
            console.log(viewport, 'viewport');
            console.log(header, 'header');
            console.log(footer, 'footer');
            console.log(viewport - header - footer);
        },
        onClose: function() {
            TapAPI.geoLocation.stopLocating();
            $(window).off('orientationchange resize', this.resizeContentArea);
        }
    });
    return mapView;
});