import expect from 'expect';

if ( !window._babelPolyfill ) {
  require( 'babel-polyfill' );
}

const NAMESPACE_MAIN = 0;
const NAMESPACE_FILE = 6;
const NAMESPACE_TEMPLATE = 10;
const NAMESPACE_CATEGORY = 14;
const NAMESPACE_RU_WIKI_PORTAL = 100;

const FilterRedirects = {
  ALL: 'all',
  NONREDIRECTS: 'nonredirects',
  REDIRECTS: 'redirects',
};

const notifyOptions = { autoHide: true, tag: 'patrollistsjs', type: 'info' };

async function updateLists() {
  await runImpl1( NAMESPACE_MAIN, 'Articles', 'статьи' );
  await runImpl1( NAMESPACE_FILE, 'Files', 'файлы' );
  await runImpl1( NAMESPACE_TEMPLATE, 'Templates', 'шаблоны' );
  await runImpl1( NAMESPACE_RU_WIKI_PORTAL, 'Portals', 'порталы' );
  await runImpl1( NAMESPACE_CATEGORY, 'Categories', 'категории' );
  mw.notify( 'Обновление всех списков завершено!', notifyOptions );
}

async function runImpl1( namespace, namespaceTitle, namespaceDesc ) {
  const noRedirects = await startImpl2( namespace, FilterRedirects.NONREDIRECTS,
    'Непроверенные (неотпатрулированные) ' + namespaceDesc
          + ' (без перенаправлений), отсортированные по времени создания',
    'Проект:Патрулирование/UnreviewedNonRedirects/' + namespaceTitle );

  const redirects = await startImpl2( namespace, FilterRedirects.REDIRECTS,
    'Непроверенные (неотпатрулированные) перенаправления на ' + namespaceDesc
          + ', отсортированные по времени создания', 'Проект:Патрулирование/UnreviewedRedirects/'
          + namespaceTitle );

  const total = new Map();
  noRedirects.forEach( ( v, k ) => total.set( k, v ) );
  redirects.forEach( ( v, k ) => total.set( k, v ) );
  await updateStatistics( 'Непроверенные (неотпатрулированные) ' + namespaceDesc
    + ' (включая перенаправления), отсортированные по времени создания',
  'Проект:Патрулирование/UnreviewedPages/' + namespaceTitle, total );
  return;
}

async function startImpl2( namespace, filterRedirects, description, statisticsPage ) {
  const pages = await queryUnreviewedPages( namespace, filterRedirects );
  await updateStatistics( description, statisticsPage, pages );
  return pages;
}

function queryUnreviewedPages( namespace, filterRedirects ) {
  const result = new Map();
  return new Promise( ( resolve, reject ) => {
    queryUnreviewedPagesImpl( namespace, filterRedirects, undefined, resolve, reject, result );
  } );
}

function queryUnreviewedPagesImpl( namespace, filterRedirects, urstart, resolve, reject, resultHolder ) {
  expect( resultHolder ).toBeA( Map );

  mw.notify( 'Query unreviewedpages of namespace ' + namespace
    + ' with redirects policy «' + filterRedirects
    + '» starting from «' + urstart
    + '» (' + resultHolder.size + ' loaded)', notifyOptions );
  new mw.Api().get( {
    action: 'query',
    list: 'unreviewedpages',
    urfilterredir: filterRedirects,
    urnamespace: namespace,
    urlimit: 500,
    urstart,
    format: 'json',
  } ).done( result => {
    result.query.unreviewedpages.forEach( p => resultHolder.set( p.pageid, p.title ) );

    if ( result.continue && result.continue.urstart ) {
      queryUnreviewedPagesImpl( namespace, filterRedirects, result.continue.urstart, resolve, reject, resultHolder );
    } else {
      resolve( resultHolder );
    }
  } ).fail( err => {
    console.log( 'Unable to request unreviewedpages from server' );
    console.log( err );
    reject( err );
  } );
}

function updateStatistics( description, statisticsPage, pages ) {
  expect( description ).toBeA( 'string' );
  expect( statisticsPage ).toBeA( 'string' );
  expect( pages ).toBeA( Map );

  const ids = [ ...pages.keys() ].sort().slice( 0, 1000 );
  const text = '{{Патрулирование/UnreviewedHeader}}\n\n' + description + '\n\n' + ids.map( id => '# <small>(' + id + ')</small> [[:' + pages.get( id ) + ']]' ).join( '\n' );

  return new Promise( ( resolve, reject ) => {
    new mw.Api().postWithEditToken( {
      action: 'edit',
      title: statisticsPage,
      text,
      summary: 'Автоматическое обновление с помощью скрипта',
    } ).done( () => {
      mw.notify( 'Successfully updated page «' + statisticsPage + '»', notifyOptions );
      resolve();
    } ).fail( reject );
  } );
}

const link = $( '<h3><a>Запустить процесс обновления списков с помощью JavaScript (процесс может занимать до 15 минут)</a></h3>' );
$( '#UnreviewedHeaderLinkAnchor' ).prepend( link );
link.click( updateLists );
