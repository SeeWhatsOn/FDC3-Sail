Feature: Find Intent API

  Background:
    Given "portfolioApp" is an app with the following intents
      | Intent Name      | Context Type   | Result Type    |
      | ViewChart        | fdc3.portfolio | fdc3.chart     |
      | StreamChart      | fdc3.portfolio | channel<chart> |
      | ViewPortfolio    | fdc3.portfolio | {empty}        |
      | StreamInstrument | fdc3.portfolio | channel        |
    And "researchApp" is an app with the following intents
      | Intent Name | Context Type | Result Type |
      | viewStock   | fdc3.product | {empty}     |
    And "analyticsApp" is an app with the following intents
      | Intent Name | Context Type | Result Type |
      | viewStock   | fdc3.product | {empty}     |
    And "marketDataApp" is an app with the following intents
      | Intent Name | Context Type | Result Type |
      | viewStock   | fdc3.product | {empty}     |
    And A desktop agent
    And "appId: App1, instanceId: a1" is opened with connection id "a1"
    And "appId: App1, instanceId: b1" is opened with connection id "b1"
    And "appId: App1, instanceId: b1" registers an intent listener for "ViewPortfolio"
    And "appId: analyticsApp, instanceId: b2" is opened with connection id "b2"
    And "appId: analyticsApp, instanceId: b2" registers an intent listener for "viewStock"
    #first app returned by directory must have an instance to cover all branches in findIntentsByContextRequest
    And "appId: researchApp, instanceId: b3" is opened with connection id "b3"
    And "appId: researchApp, instanceId: b3" registers an intent listener for "viewStock"
    And we wait for a period of "100" ms

  Scenario: Unsuccessful Find Intents Request
    When "appId: App1, instanceId: a1" finds intents with intent "ViewChart" and contextType "fdc3.instrument" and result type "{empty}"
    Then messaging will have outgoing posts
      | msg.matches_type   | msg.payload.appIntent.intent.name | msg.payload.appIntent.apps.length | to.instanceId |
      | findIntentResponse | ViewChart                         |                                 0 | a1            |

  Scenario: Unsuccessful Find Intents Request With Result Type
    When "appId: App1, instanceId: a1" finds intents with intent "ViewChart" and contextType "{empty}" and result type "unknownContext"
    Then messaging will have outgoing posts
      | msg.matches_type   | msg.payload.appIntent.intent.name | msg.payload.appIntent.apps.length | to.instanceId |
      | findIntentResponse | ViewChart                         |                                 0 | a1            |

  Scenario: Successful Find Intents Request
    When "appId: App1, instanceId: a1" finds intents with intent "ViewChart" and contextType "{empty}" and result type "{empty}"
    Then messaging will have outgoing posts
      | msg.matches_type   | msg.payload.appIntent.intent.name | msg.payload.appIntent.apps.length | msg.payload.appIntent.apps[0].appId | to.instanceId | msg.payload.appIntent.intent.displayName |
      | findIntentResponse | ViewChart                         |                                 1 | portfolioApp                        | a1            | ViewChart                                |

  Scenario: Find Intents Requests should include both the app and running instances of it
    When "appId: App1, instanceId: a1" finds intents with intent "viewStock" and contextType "fdc3.product" and result type "{empty}"
    Then messaging will have outgoing posts
      | msg.matches_type   | msg.payload.appIntent.intent.name | msg.payload.appIntent.apps.length | to.instanceId |
      | findIntentResponse | viewStock                         |                                 5 | a1            |
    When "appId: analyticsApp, instanceId: b2" is closed
    And "appId: App1, instanceId: a1" finds intents with intent "viewStock" and contextType "fdc3.product" and result type "{empty}"
    Then messaging will have outgoing posts
      | msg.matches_type   | msg.payload.appIntent.intent.name | msg.payload.appIntent.apps.length | to.instanceId |
      | findIntentResponse | viewStock                         |                                 4 | a1            |

  Scenario: Find Intents by Context Request
    When "appId: App, instanceId: a1" finds intents with contextType "fdc3.portfolio"
    Then messaging will have outgoing posts
      | msg.matches_type             | msg.payload.appIntents[0].intent.name | msg.payload.appIntents.length | to.instanceId | msg.payload.appIntents[0].intent.displayName |
      | findIntentsByContextResponse | ViewChart                             |                             4 | a1            | ViewChart                                    |

  Scenario: Find Intents by Context Request with multiple results
    When "appId: App, instanceId: a1" finds intents with contextType "fdc3.product"
    Then messaging will have outgoing posts
      | msg.matches_type             | msg.payload.appIntents[0].intent.name | msg.payload.appIntents.length | to.instanceId | msg.payload.appIntents[0].apps.length |
      | findIntentsByContextResponse | viewStock                             |                             1 | a1            |                                     5 |

  Scenario: Find Intents by Context Request with multiple results which should not include an instance that has closed
    When "appId: analyticsApp, instanceId: b2" is closed
    When "appId: App, instanceId: a1" finds intents with contextType "fdc3.product"
    Then messaging will have outgoing posts
      | msg.matches_type             | msg.payload.appIntents[0].intent.name | msg.payload.appIntents.length | to.instanceId | msg.payload.appIntents[0].apps.length |
      | findIntentsByContextResponse | viewStock                             |                             1 | a1            |                                     4 |

  Scenario: Successful Find Intents Request With Channel
    When "appId: App1, instanceId: a1" finds intents with intent "StreamChart" and contextType "fdc3.portfolio" and result type "channel"
    Then messaging will have outgoing posts
      | msg.matches_type   | msg.payload.appIntent.intent.name | msg.payload.appIntent.apps.length | msg.payload.appIntent.apps[0].appId | to.instanceId |
      | findIntentResponse | StreamChart                       |                                 1 | portfolioApp                        | a1            |

  Scenario: Successful Find Intents Request With A Typed Channel
    When "appId: App1, instanceId: a1" finds intents with intent "StreamChart" and contextType "{empty}" and result type "channel<chart>"
    Then messaging will have outgoing posts
      | msg.matches_type   | msg.payload.appIntent.intent.name | msg.payload.appIntent.apps.length | msg.payload.appIntent.apps[0].appId | to.instanceId |
      | findIntentResponse | StreamChart                       |                                 1 | portfolioApp                        | a1            |

  Scenario: Unsuccessful Find Intents Request With an untyped Channel
    When "appId: App1, instanceId: a1" finds intents with intent "StreamInstrument" and contextType "{empty}" and result type "channel<spurious>"
    Then messaging will have outgoing posts
      | msg.matches_type   | msg.payload.appIntent.intent.name | msg.payload.appIntent.apps.length |
      | findIntentResponse | streamAny                         |                                 0 |

  Scenario: Find Intent includes results for a running app with intent listener
    When "appId: App1, instanceId: a1" finds intents with intent "ViewPortfolio" and contextType "fdc3.portfolio" and result type "{empty}"
    Then messaging will have outgoing posts
      | msg.matches_type   | msg.payload.appIntent.intent.name | msg.payload.appIntent.apps.length | to.instanceId |
      | findIntentResponse | ViewPortfolio                     |                                 2 | a1            |
    And messaging will have outgoing posts
      | msg.payload.appIntent.apps[1].appId | msg.payload.appIntent.apps[1].instanceId |
      | App1                                | b1                                       |
    And messaging will have outgoing posts
      | msg.payload.appIntent.apps[0].appId | msg.payload.appIntent.apps[0].instanceId |
      | portfolioApp                        | {empty}                                  |

  Scenario: Disconnecting The Intent Listener
    When "appId: App1, instanceId: b1" unsubscribes an intent listener with id "uuid3"
    And "appId: App1, instanceId: a1" finds intents with intent "ViewPortfolio" and contextType "fdc3.portfolio" and result type "{empty}"
    Then messaging will have outgoing posts
      | msg.matches_type                  | msg.payload.appIntent.intent.name | msg.payload.appIntent.apps.length | to.instanceId | msg.payload.appIntent.apps[0].appId |
      | intentListenerUnsubscribeResponse | {null}                            | {null}                            | b1            | {null}                              |
      | findIntentResponse                | ViewPortfolio                     |                                 1 | a1            | portfolioApp                        |

  Scenario: Find Intent excludes results for a closed app with intent listener
    When "appId: App1, instanceId: b1" is closed
    And "appId: App1, instanceId: a1" finds intents with intent "ViewPortfolio" and contextType "fdc3.portfolio" and result type "{empty}"
    Then messaging will have outgoing posts
      | msg.matches_type   | msg.payload.appIntent.intent.name | msg.payload.appIntent.apps.length | to.instanceId | msg.payload.appIntent.apps[0].appId |
      | findIntentResponse | ViewPortfolio                     |                                 1 | a1            | portfolioApp                        |
