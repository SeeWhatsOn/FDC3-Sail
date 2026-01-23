Feature: Raising Intents

  Background:
    Given "portfolioApp" is an app with the following intents
      | Intent Name    | Context Type    | Result Type |
      | ViewPortfolio  | fdc3.portfolio  | {empty}     |
      | ViewChart      | fdc3.portfolio  | {empty}     |
      | ViewInstrument | fdc3.instrument | {empty}     |
    And "listenerApp" is an app with the following intents
      | Intent Name | Context Type   | Result Type |
      | ViewChart   | fdc3.portfolio | {empty}     |
    And "uniqueIntentApp" is an app with the following intents
      | Intent Name  | Context Type    | Result Type |
      | uniqueIntent | fdc3.instrument | {empty}     |
    And "unusedApp" is an app with the following intents
      | Intent Name | Context Type | Result Type |
    And A desktop agent
    And "appId: uniqueIntentApp, instanceId: c1" is opened with connection id "c1"
    And "appId: uniqueIntentApp, instanceId: c1" registers an intent listener for "uniqueIntent" [fdc3.addIntentListener]
    And "appId: App1, instanceId: a1" is opened with connection id "a1"
    And "appId: listenerApp, instanceId: b1" is opened with connection id "b1"
    And "appId: listenerApp, instanceId: b1" registers an intent listener for "ViewPortfolio" [fdc3.addIntentListener]

  Scenario: Context Not Handled By App
    When "appId: App1, instanceId: a1" raises an intent for "ViewChart" with contextType "fdc3.instrument" on app "appId: listenerApp, instanceId: b1" [fdc3.raiseIntent]
    Then messaging will have outgoing posts
      | msg.type            | msg.payload.error | to.instanceId |
      | raiseIntentResponse | NoAppsFound       | a1            |

  Scenario: Raising an intent that should auto-resolve (only one option)
    And "appId: App1, instanceId: a1" raises an intent for "uniqueIntent" with contextType "fdc3.instrument" [fdc3.raiseIntent]
    Then messaging will have outgoing posts
      | msg.matches_type    | msg.payload.context.type | msg.payload.intent | msg.payload.originatingApp.appId | msg.payload.originatingApp.instanceId | msg.payload.intentResolution.intent | to.instanceId | to.appId        | msg.payload.intentResolution.source.appId |
      | intentEvent         | fdc3.instrument          | uniqueIntent       | App1                             | a1                                    | {null}                              | c1            | uniqueIntentApp | {null}                                    |
      | raiseIntentResponse | {null}                   | {null}             | {null}                           | {null}                                | uniqueIntent                        | a1            | App1            | uniqueIntentApp                           |

  Scenario: Raising an Intent to a Non-Existent App
    And "appId: App1, instanceId: a1" raises an intent for "ViewPortfolio" with contextType "fdc3.portfolio" on app "completelyMadeUp" [fdc3.raiseIntent]
    Then messaging will have outgoing posts
      | msg.type            | msg.payload.error    | to.instanceId | to.appId |
      | raiseIntentResponse | TargetAppUnavailable | a1            | App1     |

  Scenario: Raising An Intent To A Non-Existent App Instance
    When "appId: App1, instanceId: a1" raises an intent for "ViewPortfolio" with contextType "fdc3.portfolio" on app "portfolioApp/unknownInstance" [fdc3.raiseIntent]
    Then messaging will have outgoing posts
      | msg.type            | msg.payload.error         | to.instanceId |
      | raiseIntentResponse | TargetInstanceUnavailable | a1            |

  Scenario: Raising An Intent To A Running App instance by instanceId
    When "appId: App1, instanceId: a1" raises an intent for "ViewChart" with contextType "fdc3.portfolio" on app "appId: listenerApp, instanceId: b1" [fdc3.raiseIntent]
    Then messaging will have outgoing posts
      | msg.matches_type    | msg.payload.context.type | msg.payload.intent | msg.payload.originatingApp.appId | msg.payload.originatingApp.instanceId | msg.payload.intentResolution.intent | to.instanceId | to.appId    | msg.payload.intentResolution.source.appId |
      | intentEvent         | fdc3.portfolio           | ViewChart          | App1                             | a1                                    | {null}                              | b1            | listenerApp | {null}                                    |
      | raiseIntentResponse | {null}                   | {null}             | {null}                           | {null}                                | ViewChart                           | a1            | App1        | listenerApp                               |

  Scenario: Raising An Intent To A Non-Running App
    When "appId: App1, instanceId: a1" raises an intent for "ViewPortfolio" with contextType "fdc3.portfolio" on app "portfolioApp" [fdc3.raiseIntent]
    And "uuid-0" sends validate
    And "appId: portfolioApp, instanceId: 0" registers an intent listener for "ViewPortfolio" [fdc3.addIntentListener]
    Then messaging will have outgoing posts
      | msg.matches_type          | msg.payload.intent | to.instanceId | to.appId     | msg.payload.context.type |
      | addIntentListenerResponse | {null}             |             0 | portfolioApp | {null}                   |
      | intentEvent               | ViewPortfolio      |             0 | portfolioApp | fdc3.portfolio           |
      | raiseIntentResponse       | {null}             | a1            | App1         | {null}                   |

  Scenario: Raising An Intent That Applies to A Non-Running But Uniquely Identifiable App
    When "appId: App1, instanceId: a1" raises an intent for "ViewInstrument" with contextType "fdc3.instrument" [fdc3.raiseIntent]
    And "uuid-0" sends validate
    And "appId: portfolioApp, instanceId: 0" registers an intent listener for "ViewInstrument" [fdc3.addIntentListener]
    Then messaging will have outgoing posts
      | msg.matches_type          | msg.payload.intent | to.instanceId | to.appId     | msg.payload.context.type |
      | addIntentListenerResponse | {null}             |             0 | portfolioApp | {null}                   |
      | intentEvent               | ViewInstrument     |             0 | portfolioApp | fdc3.instrument          |
      | raiseIntentResponse       | {null}             | a1            | App1         | {null}                   |

  Scenario: Raising an Intent to a Non-Existent App Instance
    And "appId: App1, instanceId: a1" raises an intent for "ViewPortfolio" with contextType "fdc3.portfolio" on app "appId: unusedApp, instanceId: u1" [fdc3.raiseIntent]
    Then messaging will have outgoing posts
      | msg.type            | msg.payload.error         | to.instanceId | to.appId |
      | raiseIntentResponse | TargetInstanceUnavailable | a1            | App1     |

  Scenario: Raising an Intent to an invalid App Instance
    And "appId: App1, instanceId: a1" raises an intent for "ViewPortfolio" with contextType "fdc3.portfolio" on an invalid app instance [fdc3.raiseIntent]
    Then messaging will have outgoing posts
      | msg.type            | msg.payload.error    | to.instanceId | to.appId |
      | raiseIntentResponse | TargetAppUnavailable | a1            | App1     |

  Scenario: Raising An Intent To A Non-Running App without A Context Type in the listener
    When "appId: App1, instanceId: a1" raises an intent for "UpdatePortfolio" with contextType "fdc3.portfolio" on app "portfolioApp" [fdc3.raiseIntent]
    And "uuid-0" sends validate
    And "portfolioApp/uuid-0" registers an intent listener for "UpdatePortfolio" [fdc3.addIntentListener]
    Then messaging will have outgoing posts
      | msg.matches_type          | msg.payload.intent | to.instanceId | to.appId     | msg.payload.context.type |
      | addIntentListenerResponse | {null}             | uuid-0        | portfolioApp | {null}                   |
      | intentEvent               | UpdatePortfolio    | uuid-0        | portfolioApp | fdc3.portfolio           |
      | raiseIntentResponse       | {null}             | a1            | App1         | {null}                   |
    And running apps will be
      | appId           | instanceId |
      | uniqueIntentApp | c1         |
      | listenerApp     | b1         |
      | App1            | a1         |
      | portfolioApp    | uuid-0     |

  Scenario: Raising An Intent To A Broken App that doesn't add an intent listener
    When "appId: App1, instanceId: a1" raises an intent for "ViewPortfolio" with contextType "fdc3.portfolio" on app "portfolioApp" [fdc3.raiseIntent]
    And "uuid-0" sends validate
    And we wait for the intent timeout
    Then running apps will be
      | appId           | instanceId |
      | uniqueIntentApp | c1         |
      | listenerApp     | b1         |
      | App1            | a1         |
      | portfolioApp    | uuid-0     |
    Then messaging will have outgoing posts
      | msg.type            | msg.payload.error    | to.instanceId | to.appId |
      | raiseIntentResponse | IntentDeliveryFailed | a1            | App1     |

  Scenario: User Must Choose An Intent using The Intent Resolver
    When "appId: App1, instanceId: a1" raises an intent for "ViewChart" with contextType "fdc3.portfolio" [fdc3.raiseIntent]
    Then messaging will have outgoing posts
      | msg.type            | msg.payload.appIntent.intent.name | msg.payload.appIntent.intent.displayName | to.instanceId | to.appId |
      | raiseIntentResponse | ViewChart                         | ViewChart                                | a1            | App1     |
    Then messaging will have outgoing posts
      | msg.payload.appIntent.apps[0].appId | msg.payload.appIntent.apps[0].instanceId |
      | listenerApp                         | b1                                       |
    Then messaging will have outgoing posts
      | msg.payload.appIntent.apps[1].appId | msg.payload.appIntent.apps[1].instanceId |
      | portfolioApp                        | {null}                                   |
    Then messaging will have outgoing posts
      | msg.payload.appIntent.apps[2].appId | msg.payload.appIntent.apps[2].instanceId |
      | listenerApp                         | {null}                                   |

  Scenario: Dynamic registrations are displayed in the app resolver
    When "appId: App2, instanceId: a2" registers an intent listener for "ViewChart" with contextType "fdc3.portfolio" [fdc3.addIntentListener]
    When "appId: App1, instanceId: a1" raises an intent for "ViewChart" with contextType "fdc3.portfolio" [fdc3.raiseIntent]
    Then messaging will have outgoing posts
      | msg.type            | msg.payload.appIntent.intent.name | msg.payload.appIntent.intent.displayName | to.instanceId | to.appId |
      | raiseIntentResponse | ViewChart                         | ViewChart                                | a1            | App1     |
    Then messaging will have outgoing posts
      | msg.payload.appIntent.apps[0].appId | msg.payload.appIntent.apps[0].instanceId |
      | listenerApp                         | b1                                       |
    Then messaging will have outgoing posts
      | msg.payload.appIntent.apps[1].appId | msg.payload.appIntent.apps[1].instanceId |
      | App2                                | a2                                       |
    Then messaging will have outgoing posts
      | msg.payload.appIntent.apps[2].appId | msg.payload.appIntent.apps[2].instanceId |
      | portfolioApp                        | {null}                                   |
    Then messaging will have outgoing posts
      | msg.payload.appIntent.apps[3].appId | msg.payload.appIntent.apps[3].instanceId |
      | listenerApp                         | {null}                                   |

  Scenario: Raising An Invalid Intent to the server (no instance)
    When "appId: App1, instanceId: a1" raises an intent for "ViewChart" with contextType "fdc3.portfolio" on app "appId: listenerApp, instanceId: z1" [fdc3.raiseIntent]
    Then messaging will have outgoing posts
      | msg.payload.error         | msg.type            |
      | TargetInstanceUnavailable | raiseIntentResponse |

  Scenario: Raising An Invalid Intent (no app)
    When "appId: App1, instanceId: a1" raises an intent for "ViewChart" with contextType "fdc3.portfolio" on app "nonExistentApp" [fdc3.raiseIntent]
    Then messaging will have outgoing posts
      | msg.payload.error    | msg.type            |
      | TargetAppUnavailable | raiseIntentResponse |

  Scenario: Raising An Invalid Intent (non existent intent)
    When "appId: App1, instanceId: a1" raises an intent for "nonExistentIntent" with contextType "fdc3.portfolio" [fdc3.raiseIntent]
    Then messaging will have outgoing posts
      | msg.payload.error | msg.type            |
      | NoAppsFound       | raiseIntentResponse |

  Scenario: Raising An Invalid Intent (non existent intent but valid app)
    When "appId: App1, instanceId: a1" raises an intent for "nonExistentIntent" with contextType "fdc3.portfolio" on app "appId: listenerApp, instanceId: b1" [fdc3.raiseIntent]
    Then messaging will have outgoing posts
      | msg.payload.error | msg.type            |
      | NoAppsFound       | raiseIntentResponse |
