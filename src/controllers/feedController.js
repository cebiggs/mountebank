'use strict';

var fs = require('fs'),
    ejs = require('ejs'),
    helpers = require('../util/helpers');

function create (releases, options) {

    // Init once since we hope many consumers poll the heroku feed and we don't have monitoring
    var feedReleases = helpers.clone(releases);
    feedReleases.reverse();

    function releaseViewFor (version) {
        return 'releases/' + version + '.ejs';
    }

    function releaseFilenameFor (version) {
        return __dirname + '/../views/' + releaseViewFor(version);
    }

    function getFeed (request, response) {
        var page = parseInt(request.query.page || '1'),
            nextPage = page + 1,
            entriesPerPage = 10,
            hasNextPage = feedReleases.slice((nextPage * entriesPerPage) - 10, entriesPerPage * nextPage).length > 0,
            config = {
                host: request.headers.host,
                releases: feedReleases.slice(page * entriesPerPage - 10, entriesPerPage * page),
                hasNextPage: hasNextPage,
                nextLink: '/feed?page=' + nextPage
            };

        if (!feedReleases[0].view) {
            feedReleases.forEach(function (release) {
                var contents = fs.readFileSync(releaseFilenameFor(release.version), { encoding: 'utf8' });
                release.view = ejs.render(contents, {
                    host: request.headers.host,
                    releaseMajorMinor: release.version.replace(/^v(\d+\.\d+).*/, '$1'),
                    releaseVersion: release.version.replace('v', '')
                });
            });
        }

        response.type('application/atom+xml');
        response.render('feed', config);
    }

    function getReleases (request, response) {
        response.render('releases', { releases: feedReleases });
    }

    function getRelease (request, response) {
        var version = request.params.version,
            config = {
                host: request.headers.host,
                heroku: options.heroku,
                releaseMajorMinor: version.replace(/^v(\d+\.\d+).*/, '$1'),
                releaseVersion: version.replace('v', '')
            };

        if (fs.existsSync(releaseFilenameFor(version))) {
            response.render('_header', config, function (error, header) {
                response.render(releaseViewFor(version), config, function (error, body) {
                    response.render('_footer', config, function (error, footer) {
                        response.send(header + body + footer);
                    });
                });
            });
        }
        else {
            response.status(404).send('No such release');
        }
    }

    return {
        getFeed: getFeed,
        getReleases: getReleases,
        getRelease: getRelease
    };
}

module.exports = {
    create: create
};
