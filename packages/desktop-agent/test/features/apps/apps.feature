Feature: Opening and Requesting App Details

  Background:
    Given "portfolioApp" is an app with the following intents
      | Intent Name   | Context Type   | Result Type |
      | ViewPortfolio | fdc3.portfolio | {empty}     |
    And "chartApp" is an app with the following intents
      | Intent Name | Context Type   | Result Type |
      | ViewChart   | fdc3.portfolio | fdc3.chart  |
    And A desktop agent
    And "appId: portfolioApp, instanceId: a1" is opened with connection id "a1"

  Scenario: Looking up app metadata
    When "appId: portfolioApp, instanceId: a1" requests metadata for "chartApp"
    Then messaging will have outgoing posts
      | msg.payload.appMetadata.appId | to.instanceId | msg.matches_type       |
      | chartApp                      | a1            | getAppMetadataResponse |

  Scenario: Looking up app metadata from missing app
    When "appId: portfolioApp, instanceId: a1" requests metadata for "unknownApp"
    Then messaging will have outgoing posts
      | msg.payload.error    | to.instanceId | msg.type               |
      | TargetAppUnavailable | a1            | getAppMetadataResponse |

  Scenario: Looking up app metadata for non-running app from directory
    Given "researchApp" is an app with the following intents
      | Intent Name    | Context Type   | Result Type |
      | ViewResearch   | fdc3.instrument | {empty}    |
    And A desktop agent
    And "appId: portfolioApp, instanceId: a1" is opened with connection id "a1"
    When "appId: portfolioApp, instanceId: a1" requests metadata for "researchApp"
    Then messaging will have outgoing posts
      | msg.payload.appMetadata.appId | msg.payload.appMetadata.title | to.instanceId | msg.matches_type       |
      | researchApp                   | researchApp                   | a1            | getAppMetadataResponse |

  Scenario: Looking up app metadata for running app includes instanceId
    Given "chartApp" is an app with the following intents
      | Intent Name | Context Type   | Result Type |
      | ViewChart   | fdc3.instrument | {empty}    |
    And A desktop agent
    And "appId: portfolioApp, instanceId: a1" is opened with connection id "a1"
    And "appId: chartApp, instanceId: chart-123" is opened with connection id "chart-123"
    When "appId: portfolioApp, instanceId: a1" requests metadata for "chartApp"
    Then messaging will have outgoing posts
      | msg.payload.appMetadata.appId | msg.payload.appMetadata.instanceId | to.instanceId | msg.matches_type       |
      | chartApp                      | chart-123                          | a1            | getAppMetadataResponse |

  Scenario: Looking up DesktopAgent metadata
    When "appId: portfolioApp, instanceId: a1" requests info on the DesktopAgent
    Then messaging will have outgoing posts
      | msg.payload.implementationMetadata.provider | to.instanceId | msg.matches_type |
      | cucumber-provider                           | a1            | getInfoResponse  |

  Scenario: Opening An App
    When "appId: portfolioApp, instanceId: a1" opens app "chartApp"
    And "uuid-0" sends validate
    Then messaging will have outgoing posts
      | msg.matches_type                | msg.payload.appIdentifier.appId | msg.payload.appIdentifier.instanceId | msg.payload.appId | msg.payload.instanceId | to.instanceId | to.appId     |
      | WCP5ValidateAppIdentityResponse | {null}                          | {null}                               | chartApp          | uuid-0                 | uuid-0        | chartApp     |
      | openResponse                    | chartApp                        | uuid-0                               | {null}            | {null}                 | a1            | portfolioApp |

  Scenario: Chart App Reconnects
    When "appId: portfolioApp, instanceId: a1" opens app "chartApp"
    And "uuid-0" sends validate
    And we wait for a period of "100" ms
    And "uuid-0" revalidates
    Then messaging will have outgoing posts
      | msg.matches_type                | msg.payload.appIdentifier.appId | msg.payload.appIdentifier.instanceId | msg.payload.appId | msg.payload.instanceId | to.instanceId | to.appId     |
      | WCP5ValidateAppIdentityResponse | {null}                          | {null}                               | chartApp          | uuid-0                 | uuid-0        | chartApp     |
      | openResponse                    | chartApp                        | uuid-0                               | {null}            | {null}                 | a1            | portfolioApp |
      | WCP5ValidateAppIdentityResponse | {null}                          | {null}                               | chartApp          | uuid-0                 | uuid-0        | chartApp     |

  Scenario: Opening An App With Context
    When "appId: portfolioApp, instanceId: a1" opens app "chartApp" with context data "fdc3.instrument"
    And "uuid-0" sends validate
    And we wait for a period of "100" ms
    And "appId: chartApp, instanceId: uuid-0" adds a context listener on "{null}" with type "fdc3.instrument"
    Then messaging will have outgoing posts
      | msg.matches_type                | msg.payload.channelId | msg.payload.context.type | to.instanceId | to.appId     |
      | WCP5ValidateAppIdentityResponse | {null}                | {null}                   | uuid-0        | chartApp     |
      | addContextListenerResponse      | {empty}               | {empty}                  | uuid-0        | chartApp     |
      | openResponse                    | {empty}               | {empty}                  | a1            | portfolioApp |
      | broadcastEvent                  | {null}                | fdc3.instrument          | uuid-0        | chartApp     |

  Scenario: Opening An App With Context, But No Listener Added
    When "appId: portfolioApp, instanceId: a1" opens app "chartApp" with context data "fdc3.instrument"
    And "uuid-0" sends validate
    And we wait for the listener timeout
    Then messaging will have outgoing posts
      | msg.type                        | msg.payload.error | to.instanceId | to.appId     |
      | WCP5ValidateAppIdentityResponse | {null}            | uuid-0        | chartApp     |
      | openResponse                    | AppTimeout        | a1            | portfolioApp |

  Scenario: Opening A Missing App
    When "appId: portfolioApp, instanceId: a1" opens app "missingApp"
    Then messaging will have outgoing posts
      | msg.type     | msg.payload.error | to.instanceId |
      | openResponse | AppNotFound       | a1            |

  Scenario: Find Instances with No Apps Running
    And "appId: portfolioApp, instanceId: a1" findsInstances of "App1"
    Then messaging will have outgoing posts
      | msg.matches_type      | msg.payload.appIdentifiers.length | to.instanceId |
      | findInstancesResponse |                                 0 | a1            |

  Scenario: Find Instances with Some Apps Running
    When "appId: chartApp, instanceId: b1" is opened with connection id "b1"
    And "appId: chartApp, instanceId: b2" is opened with connection id "b2"
    And "appId: portfolioApp, instanceId: a1" findsInstances of "chartApp"
    And we wait for a period of "100" ms
    Then messaging will have outgoing posts
      | msg.matches_type      | msg.payload.appIdentifiers.length | msg.payload.appIdentifiers[0].instanceId | msg.payload.appIdentifiers[1].instanceId | to.instanceId | msg.payload.appId |
      | findInstancesResponse |                                 2 | b1                                       | b2                                       | a1            | {null}            |

  Scenario: Unknown App Attempts Reconnect
    When "uuid-0" revalidates
    Then messaging will have outgoing posts
      | msg.type                              | msg.payload.message    |
      | WCP5ValidateAppIdentityFailedResponse | App Instance not found |
