Feature: Intent Results Are Correctly Delivered

  Background:
    Given "portfolioApp" is an app with the following intents
      | Intent Name   | Context Type   | Result Type |
      | ViewPortfolio | fdc3.portfolio | {empty}     |
    And "App1" is an app with the following intents
      | Intent Name | Context Type    | Result Type |
      | viewNews    | fdc3.instrument | {empty}     |
    And A desktop agent
    And "appId: PortfolioApp, instanceId: l1" is opened with connection id "l1"
    And "appId: App1, instanceId: a1" is opened with connection id "a1"
    And "appId: PortfolioApp, instanceId: l1" registers an intent listener for "ViewPortfolio" [fdc3.addIntentListener]

  @conformance2.2
  Scenario: Waiting for an intent listener to be Added
    When "appId: PortfolioApp, instanceId: l1" raises an intent for "viewNews" with contextType "fdc3.instrument" on app "appId: App1, instanceId: a1" with requestUuid "ABC123" [fdc3.raiseIntent]
    And "appId: App1, instanceId: a1" registers an intent listener for "viewNews" [fdc3.addIntentListener]
    And "appId: App1, instanceId: a1" sends a intentResultRequest with eventUuid "uuid10" and void contents and raiseIntentUuid "ABC123" [IntentResolution.getResult]
    Then messaging will have outgoing posts
      | msg.matches_type          | msg.meta.eventUuid | to.appId     | to.instanceId | msg.payload.raiseIntentRequestUuid | msg.payload.intentResolution.source.instanceId | msg.payload.intentResult.context.type |
      | intentEvent               | uuid10             | App1         | a1            | ABC123                             | {null}                                         | {null}                                |
      | raiseIntentResponse       | {null}             | PortfolioApp | l1            | {null}                             | a1                                             | {null}                                |
      | raiseIntentResultResponse | {null}             | PortfolioApp | l1            | {null}                             | {null}                                         | {null}                                |
      | intentResultResponse      | {null}             | App1         | a1            | {null}                             | {null}                                         | {null}                                |

  @conformance2.2
  Scenario: App Returns An Intent Response
    When "appId: App1, instanceId: a1" raises an intent for "ViewPortfolio" with contextType "fdc3.portfolio" on app "appId: PortfolioApp, instanceId: l1" with requestUuid "ABC123" [fdc3.raiseIntent]
    When "appId: PortfolioApp, instanceId: l1" sends a intentResultRequest with eventUuid "uuid7" and contextType "fdc3.portfolio" and raiseIntentUuid "ABC123" [IntentResolution.getResult]
    Then messaging will have outgoing posts
      | msg.matches_type          | msg.meta.eventUuid | msg.meta.requestUuid | to.appId     | to.instanceId | msg.payload.raiseIntentRequestUuid | msg.payload.intentResolution.source.instanceId | msg.payload.intentResult.context.type |
      | intentEvent               | uuid7              | {null}               | PortfolioApp | l1            | ABC123                             | {null}                                         | {null}                                |
      | raiseIntentResponse       | {null}             | ABC123               | App1         | a1            | {null}                             | l1                                             | {null}                                |
      | raiseIntentResultResponse | {null}             | ABC123               | App1         | a1            | {null}                             | {null}                                         | fdc3.portfolio                        |
      | intentResultResponse      | {null}             | uuid9                | PortfolioApp | l1            | {null}                             | {null}                                         | {null}                                |

  @conformance2.2
  Scenario: App Returns An Intent Result
    When "appId: App1, instanceId: a1" raises an intent for "ViewPortfolio" with contextType "fdc3.portfolio" on app "appId: PortfolioApp, instanceId: l1" with requestUuid "ABC123" [fdc3.raiseIntent]
    When "appId: PortfolioApp, instanceId: l1" sends a intentResultRequest with eventUuid "uuid7" and private channel "pc1" and raiseIntentUuid "ABC123" [IntentResolution.getResult]
    Then messaging will have outgoing posts
      | msg.matches_type          | msg.meta.eventUuid | to.appId     | to.instanceId | msg.payload.raiseIntentRequestUuid | msg.payload.intentResolution.source.instanceId | msg.payload.intentResult.channel.id |
      | intentEvent               | uuid7              | PortfolioApp | l1            | ABC123                             | {null}                                         | {null}                              |
      | raiseIntentResponse       | {null}             | App1         | a1            | {null}                             | l1                                             | {null}                              |
      | raiseIntentResultResponse | {null}             | App1         | a1            | {null}                             | {null}                                         | pc1                                 |
      | intentResultResponse      | {null}             | PortfolioApp | l1            | {null}                             | {null}                                         | {null}                              |

  @conformance2.2
  Scenario: App Returns A Void Intent Result
    When "appId: App1, instanceId: a1" raises an intent for "ViewPortfolio" with contextType "fdc3.portfolio" on app "appId: PortfolioApp, instanceId: l1" with requestUuid "ABC123" [fdc3.raiseIntent]
    When "appId: PortfolioApp, instanceId: l1" sends a intentResultRequest with eventUuid "uuid7" and void contents and raiseIntentUuid "ABC123" [IntentResolution.getResult]
    Then messaging will have outgoing posts
      | msg.matches_type          | msg.meta.eventUuid | to.appId     | to.instanceId | msg.payload.raiseIntentRequestUuid | msg.payload.intentResolution.source.instanceId | msg.payload.intentResult.context.type |
      | intentEvent               | uuid7              | PortfolioApp | l1            | ABC123                             | {null}                                         | {null}                                |
      | raiseIntentResponse       | {null}             | App1         | a1            | {null}                             | l1                                             | {null}                                |
      | raiseIntentResultResponse | {null}             | App1         | a1            | {null}                             | {null}                                         | {null}                                |
      | intentResultResponse      | {null}             | PortfolioApp | l1            | {null}                             | {null}                                         | {null}                                |
