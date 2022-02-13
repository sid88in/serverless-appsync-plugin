[![Tests](https://github.com/sid88in/serverless-appsync-plugin/workflows/Tests/badge.svg)](https://github.com/sid88in/serverless-appsync-plugin/actions?query=workflow%3ATests) <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-69-orange.svg?style=flat-square)](#contributors-)

<!-- ALL-CONTRIBUTORS-BADGE:END -->

Deploy [AppSync](https://aws.amazon.com/appsync) API's in minutes using this [Serverless](https://www.serverless.com/) plugin.

# Minimum requirements

- [Node.js v14 or higher](https://nodejs.org)
- [Serverless v3.0.0 or higher](https://github.com/serverless/serverless)

# Installation

```
npm install serverless-appsync-plugin
```

# Quick start

```yaml
service: my-app

plugins:
  - serverless-appsync-plugin

provider:
  name: aws

appSync:
  name: my-api
  authentication:
    type: API_KEY

  resolvers:
    Query.user:
      dataSource: my-table

  dataSources:
    my-table:
      type: AMAZON_DYNAMODB
      config:
        tableName: ${sls:stage}-data
```

## Concepts

- [DataSources](doc/dataSources.md)
- [Resolvers](doc/resolvers.md)
- [Authentication](doc/authentication.md)
- [API keys](doc/API-keys.md)
- [VTL Template Substitutions](doc/substitutions.md)
- [Caching](doc/caching.md)

# Contributing

If you have any questions, issue, feature request, please feel free to [open an issue](/issues/new).

You are also very welcome to open a PR and we will gladely review it.

# Resources

## VSCode extensions

- [AppSync Utils](https://marketplace.visualstudio.com/items?itemName=bboure.vscode-appsync-utils): A collection of snippets that make AppSync development easier
- [AppSync Resolver Autocomplete](https://marketplace.visualstudio.com/items?itemName=theBenForce.appsync-resolver-autocomplete): Autocomplete support for VTL template files.

## Video tutorials

- [Building an AppSync + Serverless Framework Backend | FooBar](https://www.youtube.com/watch?v=eTUYqI_LCQ4)

## Blog tutorial

- _Part 1:_ [Running a scalable & reliable GraphQL endpoint with Serverless](https://serverless.com/blog/running-scalable-reliable-graphql-endpoint-with-serverless/)

- _Part 2:_ [AppSync Backend: AWS Managed GraphQL Service](https://medium.com/@sid88in/running-a-scalable-reliable-graphql-endpoint-with-serverless-24c3bb5acb43)

- _Part 3:_ [AppSync Frontend: AWS Managed GraphQL Service](https://hackernoon.com/running-a-scalable-reliable-graphql-endpoint-with-serverless-db16e42dc266)

- _Part 4:_ [Serverless AppSync Plugin: Top 10 New Features](https://medium.com/hackernoon/serverless-appsync-plugin-top-10-new-features-3faaf6789480)

# Contributors ✨

Thanks goes to these wonderful people :clap:

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/bboure"><img src="https://avatars0.githubusercontent.com/u/7089997?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Benoît Bouré</b></sub></a><br /><a href="#maintenance-bboure" title="Maintenance">🚧</a> <a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=bboure" title="Code">💻</a></td>
    <td align="center"><a href="https://twitter.com/mrsanfran2"><img src="https://avatars2.githubusercontent.com/u/1587005?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Siddharth Gupta</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=sid88in" title="Code">💻</a></td>
    <td align="center"><a href="https://twitter.com/nikgraf"><img src="https://avatars1.githubusercontent.com/u/223045?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Nik Graf</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=nikgraf" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/Foosballfan"><img src="https://avatars3.githubusercontent.com/u/15104463?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Charles Killer</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=Foosballfan" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/jpstrikesback"><img src="https://avatars3.githubusercontent.com/u/445563?v=4?s=100" width="100px;" alt=""/><br /><sub><b>jpstrikesback</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=jpstrikesback" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/zy"><img src="https://avatars1.githubusercontent.com/u/284540?v=4?s=100" width="100px;" alt=""/><br /><sub><b>ZY</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=zy" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/francisu"><img src="https://avatars3.githubusercontent.com/u/944949?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Francis Upton IV</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=francisu" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/trilliput"><img src="https://avatars1.githubusercontent.com/u/807663?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Ilya Shmygol</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=trilliput" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/maddijoyce"><img src="https://avatars2.githubusercontent.com/u/2224291?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Maddi Joyce</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=maddijoyce" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/sebflipper"><img src="https://avatars2.githubusercontent.com/u/144435?v=4?s=100" width="100px;" alt=""/><br /><sub><b>sebflipper</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=sebflipper" title="Code">💻</a></td>
    <td align="center"><a href="https://www.erezro.com/"><img src="https://avatars0.githubusercontent.com/u/26760571?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Erez Rokah</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=erezrokah" title="Code">💻</a></td>
    <td align="center"><a href="https://www.twitter.com/deadcoder0904"><img src="https://avatars1.githubusercontent.com/u/16436270?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Akshay Kadam (A2K)</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=deadcoder0904" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/AntonShevel"><img src="https://avatars2.githubusercontent.com/u/5391187?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Anton</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=AntonShevel" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/hardchor"><img src="https://avatars0.githubusercontent.com/u/307162?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Burkhard Reffeling</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=hardchor" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/deankostomaj"><img src="https://avatars1.githubusercontent.com/u/3761480?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Dean Koštomaj</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=deankostomaj" title="Code">💻</a></td>
    <td align="center"><a href="https://blog.lesierse.com/"><img src="https://avatars0.githubusercontent.com/u/270232?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Vincent Lesierse</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=vlesierse" title="Code">💻</a></td>
    <td align="center"><a href="https://riotz.works/"><img src="https://avatars3.githubusercontent.com/u/31102213?v=4?s=100" width="100px;" alt=""/><br /><sub><b>lulzneko</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=lulzneko" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/thomasmichaelwallace"><img src="https://avatars1.githubusercontent.com/u/1954845?v=4?s=100" width="100px;" alt=""/><br /><sub><b>thomas michael wallace</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=thomasmichaelwallace" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/c10h22"><img src="https://avatars3.githubusercontent.com/u/305888?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Adnene KHALFA</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=c10h22" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/roznalex"><img src="https://avatars0.githubusercontent.com/u/8004948?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Alex Rozn</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=roznalex" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/kinyat"><img src="https://avatars0.githubusercontent.com/u/1476974?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Eric Chan</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=kinyat" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="http://josephle.me/"><img src="https://avatars1.githubusercontent.com/u/2822954?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Joseph</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=josephnle" title="Code">💻</a></td>
    <td align="center"><a href="http://miha.website/"><img src="https://avatars1.githubusercontent.com/u/142531?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Miha Eržen</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=mihaerzen" title="Code">💻</a></td>
    <td align="center"><a href="http://mike.fogel.ca/"><img src="https://avatars0.githubusercontent.com/u/69902?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Mike Fogel</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=mfogel" title="Code">💻</a></td>
    <td align="center"><a href="https://philippmuens.com/"><img src="https://avatars3.githubusercontent.com/u/1606004?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Philipp Muens</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=pmuens" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/toxuin"><img src="https://avatars1.githubusercontent.com/u/868268?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Toxuin</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=toxuin" title="Code">💻</a></td>
    <td align="center"><a href="http://hypexr.org/"><img src="https://avatars1.githubusercontent.com/u/5427?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Scott Rippee</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=hypexr" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/yai333"><img src="https://avatars2.githubusercontent.com/u/29742643?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Yi Ai</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=yai333" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/markvp"><img src="https://avatars2.githubusercontent.com/u/6936351?v=4?s=100" width="100px;" alt=""/><br /><sub><b>markvp</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=markvp" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/alexleonescalera"><img src="https://avatars2.githubusercontent.com/u/14811478?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Alex</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=alexleonescalera" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/alexjurkiewicz"><img src="https://avatars0.githubusercontent.com/u/379509?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Alex Jurkiewicz</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=alexjurkiewicz" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/anasqadrei"><img src="https://avatars1.githubusercontent.com/u/4755353?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Anas Qaderi</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=anasqadrei" title="Code">💻</a></td>
    <td align="center"><a href="http://www.heissenberger.at/"><img src="https://avatars2.githubusercontent.com/u/200095?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Andreas Heissenberger</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=aheissenberger" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/Mickael"><img src="https://avatars1.githubusercontent.com/u/32233?v=4?s=100" width="100px;" alt=""/><br /><sub><b>mickael</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=Mickael" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/btorresgil"><img src="https://avatars2.githubusercontent.com/u/4164289?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Brian Torres-Gil</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=btorresgil" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/cameroncf"><img src="https://avatars2.githubusercontent.com/u/789760?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Cameron Childress</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=cameroncf" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/cc07"><img src="https://avatars1.githubusercontent.com/u/26186634?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Chris Chiang</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=cc07" title="Code">💻</a></td>
    <td align="center"><a href="https://www.linkedin.com/in/siliconvalleynextgeneration/"><img src="https://avatars0.githubusercontent.com/u/1230575?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Esref Durna</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=EsrefDurna" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/lkhari"><img src="https://avatars0.githubusercontent.com/u/3062396?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Hari</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=lkhari" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/ivanbarlog"><img src="https://avatars2.githubusercontent.com/u/2583610?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Ivan Barlog</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=ivanbarlog" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/jveldboom"><img src="https://avatars2.githubusercontent.com/u/303202?v=4?s=100" width="100px;" alt=""/><br /><sub><b>John Veldboom</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=jveldboom" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/bigluck"><img src="https://avatars2.githubusercontent.com/u/1511095?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Luca Bigon</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=bigluck" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://twitter.com/sketchingdev"><img src="https://avatars2.githubusercontent.com/u/31957045?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Lucas</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=SketchingDev" title="Code">💻</a></td>
    <td align="center"><a href="https://markpollmann.com/"><img src="https://avatars2.githubusercontent.com/u/5286559?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Mark Pollmann</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=MarkPollmann" title="Code">💻</a></td>
    <td align="center"><a href="http://www.twitter.com/@morficus"><img src="https://avatars3.githubusercontent.com/u/718799?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Maurice Williams</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=morficus" title="Code">💻</a></td>
    <td align="center"><a href="http://www.cedar.ai/"><img src="https://avatars0.githubusercontent.com/u/1109028?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Mike Chen</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=chensjlv" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/asnaseer-resilient"><img src="https://avatars1.githubusercontent.com/u/6410094?v=4?s=100" width="100px;" alt=""/><br /><sub><b>asnaseer-resilient</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=asnaseer-resilient" title="Code">💻</a></td>
    <td align="center"><a href="http://www.treadbook.com/"><img src="https://avatars3.githubusercontent.com/u/2530264?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Neal Clark</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=nealclark" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/moelholm"><img src="https://avatars2.githubusercontent.com/u/8393156?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Nicky Moelholm</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=moelholm" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://patrick.wtf/"><img src="https://avatars1.githubusercontent.com/u/667029?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Patrick Arminio</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=patrick91" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/engineforce"><img src="https://avatars0.githubusercontent.com/u/3614365?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Paul Li</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=engineforce" title="Code">💻</a></td>
    <td align="center"><a href="https://conduit.vc/"><img src="https://avatars3.githubusercontent.com/u/322957?v=4?s=100" width="100px;" alt=""/><br /><sub><b>James Lal</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=lightsofapollo" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/thenengah"><img src="https://avatars2.githubusercontent.com/u/32788783?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Sam Gilman</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=thenengah" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/stefanceriu"><img src="https://avatars2.githubusercontent.com/u/637564?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Stefan Ceriu</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=stefanceriu" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/tsmith"><img src="https://avatars2.githubusercontent.com/u/339175?v=4?s=100" width="100px;" alt=""/><br /><sub><b>tsmith</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=tsmith" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/veloware"><img src="https://avatars1.githubusercontent.com/u/61578546?v=4?s=100" width="100px;" alt=""/><br /><sub><b>veloware</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=veloware" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/nadalfederer"><img src="https://avatars1.githubusercontent.com/u/6043510?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Vladimir Lebedev</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=nadalfederer" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/Znergy"><img src="https://avatars1.githubusercontent.com/u/18511689?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Ryan Jones</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=Znergy" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/vicary"><img src="https://avatars0.githubusercontent.com/u/85772?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Vicary A.</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=vicary" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/bsantare"><img src="https://avatars2.githubusercontent.com/u/29000522?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Brian Santarelli</b></sub></a><br /><a href="#ideas-bsantare" title="Ideas, Planning, & Feedback">🤔</a></td>
    <td align="center"><a href="https://github.com/EmiiFont"><img src="https://avatars.githubusercontent.com/u/4354709?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Emilio Font</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=EmiiFont" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/anastyn"><img src="https://avatars.githubusercontent.com/u/743872?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Andriy Nastyn</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=anastyn" title="Code">💻</a> <a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=anastyn" title="Documentation">📖</a></td>
    <td align="center"><a href="http://marcusjones.github.io/"><img src="https://avatars.githubusercontent.com/u/797625?v=4?s=100" width="100px;" alt=""/><br /><sub><b>MarcusJones</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=MarcusJones" title="Documentation">📖</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/h-kishi"><img src="https://avatars.githubusercontent.com/u/8940568?v=4?s=100" width="100px;" alt=""/><br /><sub><b>h-kishi</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=h-kishi" title="Code">💻</a></td>
    <td align="center"><a href="https://dillonbrowne.com/"><img src="https://avatars.githubusercontent.com/u/32145095?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Dillon Browne</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=dillonbrowne" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/pgrzesik"><img src="https://avatars.githubusercontent.com/u/17499590?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Piotr Grzesik</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=pgrzesik" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/AleksaC"><img src="https://avatars.githubusercontent.com/u/25728391?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Aleksa Cukovic</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=AleksaC" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/sc0ttdav3y"><img src="https://avatars.githubusercontent.com/u/405607?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Scott Davey</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=sc0ttdav3y" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/mshlz"><img src="https://avatars.githubusercontent.com/u/37939755?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Mateus Holzschuh</b></sub></a><br /><a href="https://github.com/sid88in/serverless-appsync-plugin/commits?author=mshlz" title="Code">💻</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
