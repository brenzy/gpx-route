# gpx-route

## GPX Route Creator/Editor with side-by-side Street View display using the Google Maps JavaScript API V3

I love exploring new places on Google Street View while riding GPX routes on my Tacx
trainer.  I created this application because I couldn't find a GPX editor that contained all the features that I
wanted for creating these routes.

This GPX editor displays the location of the Street View layer on the map, and allows you to see Street View
while you are creating and editing the route.  It provides functionality that attempts to nudge the route
onto an area that has Street View.  It can also attempt to interpolate street view points for routes segments that
are added when there are no directions available.  This make it possible to create routes over water, for instance, through
the Grand Canyon or the canals of Venice.

This program is subject to Google usage limits.  If this program is not working, usage limits my have been
exceeded.

This is a work in progress.  Many of the features need more work.  You can however create a good route for riding
on a Tacx trainer if you know how to talk to the application nicely.

Known Issues
* There are several functions (such as download) that will not work in IE and/or older browsers
* There is a maximum size to the paths that can be stored in google maps.  If your route exceeds this limit, the application will fail.
* Some edits breaks the undo/redo stack

Disclaimer: The user is responsible for insuring the accuracy and correctness of the routes produced by this application.
