Feature: Intent Results Are Correctly Delivered

  Background:
    Given schemas loaded
    And "portfolioApp" is an app with the following intents
      | Intent Name   | Context Type      | Result Type |
      | ViewPortfolio | fdc3.portfolio     | {empty}     |
    And "App1" is an app with the following intents
      | Intent Name | Context Type    | Result Type |
      | viewNews    | fdc3.instrument | {empty}     |
    And A newly instantiated desktop agent
    And "PortfolioApp/l1" is opened with connection id "l1"
    And "App1/a1" is opened with connection id "a1"
    And "PortfolioApp/l1" registers an intent listener for "ViewPortfolio"

  Scenario: Waiting for an intent listener to be Added
    When "PortfolioApp/l1" raises an intent for "viewNews" with contextType "fdc3.instrument" on app "App1/a1" with requestUuid "ABC123"
    And "App1/a1" registers an intent listener for "viewNews"
    And "App1/a1" sends a intentResultRequest with eventUuid "uuid10" and void contents and raiseIntentUuid "ABC123"
    Then messaging will have outgoing posts
      | msg.matches_type          | msg.meta.eventUuid | to.appId      | to.instanceId | msg.payload.raiseIntentRequestUuid | msg.payload.intentResolution.source.instanceId | msg.payload.intentResult.context.type |
      | intentEvent               | uuid10             | App1          | a1            | ABC123                             | {null}                                         | {null}                                |
      | raiseIntentResponse       | {null}             | PortfolioApp  | l1            | {null}                             | a1                                             | {null}                                |
      | raiseIntentResultResponse | {null}             | PortfolioApp  | l1            | {null}                             | {null}                                         | {null}                                |
      | intentResultResponse      | {null}             | App1          | a1            | {null}                             | {null}                                         | {null}                                |

  Scenario: App Returns An Intent Response
    When "App1/a1" raises an intent for "ViewPortfolio" with contextType "fdc3.portfolio" on app "PortfolioApp/l1" with requestUuid "ABC123"
    When "PortfolioApp/l1" sends a intentResultRequest with eventUuid "uuid7" and contextType "fdc3.portfolio" and raiseIntentUuid "ABC123"
    Then messaging will have outgoing posts
      | msg.matches_type          | msg.meta.eventUuid | msg.meta.requestUuid | to.appId      | to.instanceId | msg.payload.raiseIntentRequestUuid | msg.payload.intentResolution.source.instanceId | msg.payload.intentResult.context.type |
      | intentEvent               | uuid7              | {null}               | PortfolioApp | l1            | ABC123                             | {null}                                         | {null}                                |
      | raiseIntentResponse       | {null}             | ABC123               | App1          | a1            | {null}                             | l1                                             | {null}                                |
      | raiseIntentResultResponse | {null}             | ABC123               | App1          | a1            | {null}                             | {null}                                         | fdc3.portfolio                        |
      | intentResultResponse      | {null}             | uuid9                | PortfolioApp | l1            | {null}                             | {null}                                         | {null}                                |

  Scenario: App Returns An Intent Result
    When "App1/a1" raises an intent for "ViewPortfolio" with contextType "fdc3.portfolio" on app "PortfolioApp/l1" with requestUuid "ABC123"
    When "PortfolioApp/l1" sends a intentResultRequest with eventUuid "uuid7" and private channel "pc1" and raiseIntentUuid "ABC123"
    Then messaging will have outgoing posts
      | msg.matches_type          | msg.meta.eventUuid | to.appId      | to.instanceId | msg.payload.raiseIntentRequestUuid | msg.payload.intentResolution.source.instanceId | msg.payload.intentResult.channel.id |
      | intentEvent               | uuid7              | PortfolioApp | l1            | ABC123                             | {null}                                         | {null}                              |
      | raiseIntentResponse       | {null}             | App1          | a1            | {null}                             | l1                                             | {null}                              |
      | raiseIntentResultResponse | {null}             | App1          | a1            | {null}                             | {null}                                         | pc1                                 |
      | intentResultResponse      | {null}             | PortfolioApp | l1            | {null}                             | {null}                                         | {null}                              |

  Scenario: App Returns A Void Intent Result
    When "App1/a1" raises an intent for "ViewPortfolio" with contextType "fdc3.portfolio" on app "PortfolioApp/l1" with requestUuid "ABC123"
    When "PortfolioApp/l1" sends a intentResultRequest with eventUuid "uuid7" and void contents and raiseIntentUuid "ABC123"
    Then messaging will have outgoing posts
      | msg.matches_type          | msg.meta.eventUuid | to.appId      | to.instanceId | msg.payload.raiseIntentRequestUuid | msg.payload.intentResolution.source.instanceId | msg.payload.intentResult.context.type |
      | intentEvent               | uuid7              | PortfolioApp | l1            | ABC123                             | {null}                                         | {null}                                |
      | raiseIntentResponse       | {null}             | App1          | a1            | {null}                             | l1                                             | {null}                                |
      | raiseIntentResultResponse | {null}             | App1          | a1            | {null}                             | {null}                                         | {null}                                |
      | intentResultResponse      | {null}             | PortfolioApp | l1            | {null}                             | {null}                                         | {null}                                |
