Feature: Raising Intents For Context

  Background:
    Given schemas loaded
    And "portfolioApp" is an app with the following intents
      | Intent Name     | Context Type      | Result Type |
      | ViewPortfolio   | fdc3.portfolio     | {empty}     |
      | ViewChart       | fdc3.portfolio     | {empty}     |
      | ViewInstrument  | fdc3.instrument    | {empty}     |
    And "listenerApp" is an app with the following intents
      | Intent Name | Context Type      | Result Type |
      | ViewChart   | fdc3.portfolio    | {empty}     |
    And "unusedApp" is an app with the following intents
      | Intent Name | Context Type | Result Type |
    And A newly instantiated desktop agent
    And "App1/a1" is opened with connection id "a1"
    And "listenerApp/b1" is opened with connection id "b1"
    And "listenerApp/b1" registers an intent listener for "ViewPortfolio"

  Scenario: Raising an Intent With Context to a Non-Existent App
    And "App1/a1" raises an intent with contextType "fdc3.instrument" on app "completelyMadeUp"
    Then messaging will have outgoing posts
      | msg.type                      | msg.payload.error    | to.instanceId | to.appId |
      | raiseIntentForContextResponse | TargetAppUnavailable | a1            | App1     |

  Scenario: Raising An Intent With Context To A Non-Existent App Instance
    When "App1/a1" raises an intent with contextType "fdc3.portfolio" on app "portfolioApp/unknownInstance"
    Then messaging will have outgoing posts
      | msg.type                      | msg.payload.error         | to.instanceId |
      | raiseIntentForContextResponse | TargetInstanceUnavailable | a1            |

Scenario: Raising An Intent With Context To An Invalid Instance
    When "App1/a1" raises an intent with contextType "fdc3.portfolio" on an invalid app instance
    Then messaging will have outgoing posts
      | msg.type                      | msg.payload.error         | to.instanceId |
      | raiseIntentForContextResponse | TargetAppUnavailable      | a1            |

  Scenario: Raising An Intent With Context To A Running App
    When "App1/a1" raises an intent with contextType "fdc3.portfolio" on app "listenerApp/b1"
    Then messaging will have outgoing posts
      | msg.matches_type              | msg.payload.context.type | msg.payload.intent | msg.payload.originatingApp.appId | msg.payload.originatingApp.instanceId | msg.payload.intentResolution.intent | to.instanceId | to.appId    | msg.payload.intentResolution.source.appId |
      | intentEvent                   | fdc3.portfolio            | ViewChart          | App1                             | a1                                    | {null}                              | b1            | listenerApp | {null}                                    |
      | raiseIntentForContextResponse | {null}                   | {null}             | {null}                           | {null}                                | ViewChart                           | a1            | App1        | listenerApp                               |

  Scenario: Raising An Intent With Context To A Non-Running App
    When "App1/a1" raises an intent with contextType "fdc3.instrument" on app "portfolioApp"
    And "uuid-0" sends validate
    And "portfolioApp/0" registers an intent listener for "ViewInstrument"
    Then messaging will have outgoing posts
      | msg.matches_type              | msg.payload.intent | to.instanceId | to.appId     | msg.payload.context.type |
      | addIntentListenerResponse     | {null}             |             0 | portfolioApp | {null}                   |
      | intentEvent                   | ViewInstrument     |             0 | portfolioApp | fdc3.instrument          |
      | raiseIntentForContextResponse | {null}             | a1            | App1         | {null}                   |

  Scenario: Raising an Intent With Context to a Non-Existent App Instance
    And "App1/a1" raises an intent with contextType "fdc3.portfolio" on app "unusedApp/u1"
    Then messaging will have outgoing posts
      | msg.type                      | msg.payload.error         | to.instanceId | to.appId |
      | raiseIntentForContextResponse | TargetInstanceUnavailable | a1            | App1     |

  Scenario: Raising An Intent With Context To A Broken App that doesn't add an intent listener
    When "App1/a1" raises an intent with contextType "fdc3.instrument" on app "portfolioApp"
    And "uuid-0" sends validate
    And we wait for the intent timeout
    Then messaging will have outgoing posts
      | msg.type                      | msg.payload.error    | to.instanceId | to.appId |
      | raiseIntentForContextResponse | IntentDeliveryFailed | a1            | App1     |

  Scenario: User Must Choose An Intent using The Intent Resolver
    When "App1/a1" raises an intent with contextType "fdc3.portfolio"
    Then messaging will have outgoing posts
      | msg.type                      | msg.payload.appIntents[0].intent.name | msg.payload.appIntents[1].intent.name | to.instanceId | to.appId |
      | raiseIntentForContextResponse | ViewPortfolio                        | ViewChart                              | a1            | App1     |
    Then messaging will have outgoing posts
      | msg.payload.appIntents[0].apps[0].appId | msg.payload.appIntent.apps[0].instanceId |
      | portfolioApp                             | {null}                                   |
    Then messaging will have outgoing posts
      | msg.payload.appIntents[1].apps[0].appId | msg.payload.appIntents[1].apps[0].instanceId |
      | listenerApp                                | b1                                           |
    Then messaging will have outgoing posts
      | msg.payload.appIntents[1].apps[1].appId | msg.payload.appIntents[1].apps[1].instanceId |
      | portfolioApp                              | {null}                                       |
    Then messaging will have outgoing posts
      | msg.payload.appIntents[1].apps[2].appId | msg.payload.appIntents[1].apps[2].instanceId |
      | listenerApp                               | {null}                                       |

Scenario: Dynamic registrations are displayed in the app resolver
    When "App2/a2" registers an intent listener for "ViewPortfolio" with contextType "fdc3.portfolio"
    When "App1/a1" raises an intent with contextType "fdc3.portfolio"
    Then messaging will have outgoing posts
      | msg.type                      | msg.payload.appIntents[0].intent.name | msg.payload.appIntents[1].intent.name | to.instanceId | to.appId |
      | raiseIntentForContextResponse | ViewPortfolio                        | ViewChart                              | a1            | App1     |
    Then messaging will have outgoing posts
      | msg.payload.appIntents[0].apps[0].appId | msg.payload.appIntents[0].apps[0].instanceId |
      | App2                                       | a2                                           |
    Then messaging will have outgoing posts
      | msg.payload.appIntents[1].apps[0].appId | msg.payload.appIntents[1].apps[0].instanceId |
      | listenerApp                                | b1                                           |
    Then messaging will have outgoing posts
      | msg.payload.appIntents[1].apps[1].appId | msg.payload.appIntents[1].apps[1].instanceId |
      | portfolioApp                              | {null}                                       |
    Then messaging will have outgoing posts
      | msg.payload.appIntents[1].apps[2].appId | msg.payload.appIntents[1].apps[2].instanceId |
      | listenerApp                               | {null}                                       |
