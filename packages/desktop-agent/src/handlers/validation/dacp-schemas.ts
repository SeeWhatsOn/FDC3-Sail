// Auto-generated DACP schemas from @finos/fdc3-schema
// Generated on: 2025-09-23T08:19:55.840Z
import { z } from 'zod'

// Base DACP message structure
export const BaseDACPMessageSchema = z.object({
  type: z.string(),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date()
  })
})

export type BaseDACPMessage = z.infer<typeof BaseDACPMessageSchema>

// Context schema (simplified for now)
export const ContextSchema = z.object({
  type: z.string(),
  id: z.record(z.string(), z.unknown()).optional(),
  name: z.string().optional()
}).catchall(z.unknown()) // Allow additional properties

// Addcontextlistenerrequest
export const AddcontextlistenerrequestSchema = z.object({
  type: z.literal('addContextListenerRequest'),
  payload: z.object({
        channelId: z.string().optional(),
        contextType: z.string().optional()
      }),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Addcontextlistenerrequest = z.infer<typeof AddcontextlistenerrequestSchema>

// Addcontextlistenerresponse
export const AddcontextlistenerresponseSchema = z.object({
  type: z.literal('addContextListenerResponse'),
  payload: z.union([
        z.object({ listenerId: z.string() }), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Addcontextlistenerresponse = z.infer<typeof AddcontextlistenerresponseSchema>

// Addeventlistenerrequest
export const AddeventlistenerrequestSchema = z.object({
  type: z.literal('addEventListenerRequest'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Addeventlistenerrequest = z.infer<typeof AddeventlistenerrequestSchema>

// Addeventlistenerresponse
export const AddeventlistenerresponseSchema = z.object({
  type: z.literal('addEventListenerResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Addeventlistenerresponse = z.infer<typeof AddeventlistenerresponseSchema>

// Addintentlistenerrequest
export const AddintentlistenerrequestSchema = z.object({
  type: z.literal('addIntentListenerRequest'),
  payload: z.object({
        intent: z.string()
      }),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Addintentlistenerrequest = z.infer<typeof AddintentlistenerrequestSchema>

// Addintentlistenerresponse
export const AddintentlistenerresponseSchema = z.object({
  type: z.literal('addIntentListenerResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Addintentlistenerresponse = z.infer<typeof AddintentlistenerresponseSchema>

// Agentevent
export const AgenteventSchema = z.object({
  type: z.literal('agentEvent'),
  payload: z.unknown().optional(),
  meta: z.object({
    eventUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Agentevent = z.infer<typeof AgenteventSchema>

// Agentresponse
export const AgentresponseSchema = z.object({
  type: z.literal('agentResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Agentresponse = z.infer<typeof AgentresponseSchema>

// Api (generic)
export const ApiSchema = z.object({
  type: z.literal('api'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date()
  })
})

export type Api = z.infer<typeof ApiSchema>

// Apprequest
export const ApprequestSchema = z.object({
  type: z.literal('appRequest'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Apprequest = z.infer<typeof ApprequestSchema>

// Broadcastevent
export const BroadcasteventSchema = z.object({
  type: z.literal('broadcastEvent'),
  payload: z.unknown().optional(),
  meta: z.object({
    eventUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Broadcastevent = z.infer<typeof BroadcasteventSchema>

// Broadcastrequest
export const BroadcastrequestSchema = z.object({
  type: z.literal('broadcastRequest'),
  payload: z.object({
        channelId: z.string(),
        context: ContextSchema
      }),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Broadcastrequest = z.infer<typeof BroadcastrequestSchema>

// Broadcastresponse
export const BroadcastresponseSchema = z.object({
  type: z.literal('broadcastResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Broadcastresponse = z.infer<typeof BroadcastresponseSchema>

// Channelchangedevent
export const ChannelchangedeventSchema = z.object({
  type: z.literal('channelChangedEvent'),
  payload: z.unknown().optional(),
  meta: z.object({
    eventUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Channelchangedevent = z.infer<typeof ChannelchangedeventSchema>

// Common (generic)
export const CommonSchema = z.object({
  type: z.literal('common'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date()
  })
})

export type Common = z.infer<typeof CommonSchema>

// Contextlistenerunsubscriberequest
export const ContextlistenerunsubscriberequestSchema = z.object({
  type: z.literal('contextListenerUnsubscribeRequest'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Contextlistenerunsubscriberequest = z.infer<typeof ContextlistenerunsubscriberequestSchema>

// Contextlistenerunsubscriberesponse
export const ContextlistenerunsubscriberesponseSchema = z.object({
  type: z.literal('contextListenerUnsubscribeResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Contextlistenerunsubscriberesponse = z.infer<typeof ContextlistenerunsubscriberesponseSchema>

// Createprivatechannelrequest
export const CreateprivatechannelrequestSchema = z.object({
  type: z.literal('createPrivateChannelRequest'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Createprivatechannelrequest = z.infer<typeof CreateprivatechannelrequestSchema>

// Createprivatechannelresponse
export const CreateprivatechannelresponseSchema = z.object({
  type: z.literal('createPrivateChannelResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Createprivatechannelresponse = z.infer<typeof CreateprivatechannelresponseSchema>

// Eventlistenerunsubscriberequest
export const EventlistenerunsubscriberequestSchema = z.object({
  type: z.literal('eventListenerUnsubscribeRequest'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Eventlistenerunsubscriberequest = z.infer<typeof EventlistenerunsubscriberequestSchema>

// Eventlistenerunsubscriberesponse
export const EventlistenerunsubscriberesponseSchema = z.object({
  type: z.literal('eventListenerUnsubscribeResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Eventlistenerunsubscriberesponse = z.infer<typeof EventlistenerunsubscriberesponseSchema>

// Fdc3userinterfacechannels (generic)
export const Fdc3userinterfacechannelsSchema = z.object({
  type: z.literal('fdc3UserInterfaceChannels'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date()
  })
})

export type Fdc3userinterfacechannels = z.infer<typeof Fdc3userinterfacechannelsSchema>

// Fdc3userinterfacechannelselected (generic)
export const Fdc3userinterfacechannelselectedSchema = z.object({
  type: z.literal('fdc3UserInterfaceChannelSelected'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date()
  })
})

export type Fdc3userinterfacechannelselected = z.infer<typeof Fdc3userinterfacechannelselectedSchema>

// Fdc3userinterfacedrag (generic)
export const Fdc3userinterfacedragSchema = z.object({
  type: z.literal('fdc3UserInterfaceDrag'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date()
  })
})

export type Fdc3userinterfacedrag = z.infer<typeof Fdc3userinterfacedragSchema>

// Fdc3userinterfacehandshake (generic)
export const Fdc3userinterfacehandshakeSchema = z.object({
  type: z.literal('fdc3UserInterfaceHandshake'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date()
  })
})

export type Fdc3userinterfacehandshake = z.infer<typeof Fdc3userinterfacehandshakeSchema>

// Fdc3userinterfacehello (generic)
export const Fdc3userinterfacehelloSchema = z.object({
  type: z.literal('fdc3UserInterfaceHello'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date()
  })
})

export type Fdc3userinterfacehello = z.infer<typeof Fdc3userinterfacehelloSchema>

// Fdc3userinterfacemessage (generic)
export const Fdc3userinterfacemessageSchema = z.object({
  type: z.literal('fdc3UserInterfaceMessage'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date()
  })
})

export type Fdc3userinterfacemessage = z.infer<typeof Fdc3userinterfacemessageSchema>

// Fdc3userinterfaceresolve (generic)
export const Fdc3userinterfaceresolveSchema = z.object({
  type: z.literal('fdc3UserInterfaceResolve'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date()
  })
})

export type Fdc3userinterfaceresolve = z.infer<typeof Fdc3userinterfaceresolveSchema>

// Fdc3userinterfaceresolveaction (generic)
export const Fdc3userinterfaceresolveactionSchema = z.object({
  type: z.literal('fdc3UserInterfaceResolveAction'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date()
  })
})

export type Fdc3userinterfaceresolveaction = z.infer<typeof Fdc3userinterfaceresolveactionSchema>

// Fdc3userinterfacerestyle (generic)
export const Fdc3userinterfacerestyleSchema = z.object({
  type: z.literal('fdc3UserInterfaceRestyle'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date()
  })
})

export type Fdc3userinterfacerestyle = z.infer<typeof Fdc3userinterfacerestyleSchema>

// Findinstancesrequest
export const FindinstancesrequestSchema = z.object({
  type: z.literal('findInstancesRequest'),
  payload: z.object({
        app: z.string()
      }),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Findinstancesrequest = z.infer<typeof FindinstancesrequestSchema>

// Findinstancesresponse
export const FindinstancesresponseSchema = z.object({
  type: z.literal('findInstancesResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Findinstancesresponse = z.infer<typeof FindinstancesresponseSchema>

// Findintentrequest
export const FindintentrequestSchema = z.object({
  type: z.literal('findIntentRequest'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Findintentrequest = z.infer<typeof FindintentrequestSchema>

// Findintentresponse
export const FindintentresponseSchema = z.object({
  type: z.literal('findIntentResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Findintentresponse = z.infer<typeof FindintentresponseSchema>

// Findintentsbycontextrequest
export const FindintentsbycontextrequestSchema = z.object({
  type: z.literal('findIntentsByContextRequest'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Findintentsbycontextrequest = z.infer<typeof FindintentsbycontextrequestSchema>

// Findintentsbycontextresponse
export const FindintentsbycontextresponseSchema = z.object({
  type: z.literal('findIntentsByContextResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Findintentsbycontextresponse = z.infer<typeof FindintentsbycontextresponseSchema>

// Getappmetadatarequest
export const GetappmetadatarequestSchema = z.object({
  type: z.literal('getAppMetadataRequest'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Getappmetadatarequest = z.infer<typeof GetappmetadatarequestSchema>

// Getappmetadataresponse
export const GetappmetadataresponseSchema = z.object({
  type: z.literal('getAppMetadataResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Getappmetadataresponse = z.infer<typeof GetappmetadataresponseSchema>

// Getcurrentchannelrequest
export const GetcurrentchannelrequestSchema = z.object({
  type: z.literal('getCurrentChannelRequest'),
  payload: z.object({}).optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Getcurrentchannelrequest = z.infer<typeof GetcurrentchannelrequestSchema>

// Getcurrentchannelresponse
export const GetcurrentchannelresponseSchema = z.object({
  type: z.literal('getCurrentChannelResponse'),
  payload: z.union([
        z.object({ channel: z.string().nullable() }), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Getcurrentchannelresponse = z.infer<typeof GetcurrentchannelresponseSchema>

// Getcurrentcontextrequest
export const GetcurrentcontextrequestSchema = z.object({
  type: z.literal('getCurrentContextRequest'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Getcurrentcontextrequest = z.infer<typeof GetcurrentcontextrequestSchema>

// Getcurrentcontextresponse
export const GetcurrentcontextresponseSchema = z.object({
  type: z.literal('getCurrentContextResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Getcurrentcontextresponse = z.infer<typeof GetcurrentcontextresponseSchema>

// Getinforequest
export const GetinforequestSchema = z.object({
  type: z.literal('getInfoRequest'),
  payload: z.object({}).optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Getinforequest = z.infer<typeof GetinforequestSchema>

// Getinforesponse
export const GetinforesponseSchema = z.object({
  type: z.literal('getInfoResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Getinforesponse = z.infer<typeof GetinforesponseSchema>

// Getorcreatechannelrequest
export const GetorcreatechannelrequestSchema = z.object({
  type: z.literal('getOrCreateChannelRequest'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Getorcreatechannelrequest = z.infer<typeof GetorcreatechannelrequestSchema>

// Getorcreatechannelresponse
export const GetorcreatechannelresponseSchema = z.object({
  type: z.literal('getOrCreateChannelResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Getorcreatechannelresponse = z.infer<typeof GetorcreatechannelresponseSchema>

// Getuserchannelsrequest
export const GetuserchannelsrequestSchema = z.object({
  type: z.literal('getUserChannelsRequest'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Getuserchannelsrequest = z.infer<typeof GetuserchannelsrequestSchema>

// Getuserchannelsresponse
export const GetuserchannelsresponseSchema = z.object({
  type: z.literal('getUserChannelsResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Getuserchannelsresponse = z.infer<typeof GetuserchannelsresponseSchema>

// Heartbeatacknowledgmentrequest
export const HeartbeatacknowledgmentrequestSchema = z.object({
  type: z.literal('heartbeatAcknowledgmentRequest'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Heartbeatacknowledgmentrequest = z.infer<typeof HeartbeatacknowledgmentrequestSchema>

// Heartbeatevent
export const HeartbeateventSchema = z.object({
  type: z.literal('heartbeatEvent'),
  payload: z.unknown().optional(),
  meta: z.object({
    eventUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Heartbeatevent = z.infer<typeof HeartbeateventSchema>

// Intentevent
export const IntenteventSchema = z.object({
  type: z.literal('intentEvent'),
  payload: z.unknown().optional(),
  meta: z.object({
    eventUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Intentevent = z.infer<typeof IntenteventSchema>

// Intentlistenerunsubscriberequest
export const IntentlistenerunsubscriberequestSchema = z.object({
  type: z.literal('intentListenerUnsubscribeRequest'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Intentlistenerunsubscriberequest = z.infer<typeof IntentlistenerunsubscriberequestSchema>

// Intentlistenerunsubscriberesponse
export const IntentlistenerunsubscriberesponseSchema = z.object({
  type: z.literal('intentListenerUnsubscribeResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Intentlistenerunsubscriberesponse = z.infer<typeof IntentlistenerunsubscriberesponseSchema>

// Intentresultrequest
export const IntentresultrequestSchema = z.object({
  type: z.literal('intentResultRequest'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Intentresultrequest = z.infer<typeof IntentresultrequestSchema>

// Intentresultresponse
export const IntentresultresponseSchema = z.object({
  type: z.literal('intentResultResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Intentresultresponse = z.infer<typeof IntentresultresponseSchema>

// Joinuserchannelrequest
export const JoinuserchannelrequestSchema = z.object({
  type: z.literal('joinUserChannelRequest'),
  payload: z.object({
        channelId: z.string()
      }),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Joinuserchannelrequest = z.infer<typeof JoinuserchannelrequestSchema>

// Joinuserchannelresponse
export const JoinuserchannelresponseSchema = z.object({
  type: z.literal('joinUserChannelResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Joinuserchannelresponse = z.infer<typeof JoinuserchannelresponseSchema>

// Leavecurrentchannelrequest
export const LeavecurrentchannelrequestSchema = z.object({
  type: z.literal('leaveCurrentChannelRequest'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Leavecurrentchannelrequest = z.infer<typeof LeavecurrentchannelrequestSchema>

// Leavecurrentchannelresponse
export const LeavecurrentchannelresponseSchema = z.object({
  type: z.literal('leaveCurrentChannelResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Leavecurrentchannelresponse = z.infer<typeof LeavecurrentchannelresponseSchema>

// Openrequest
export const OpenrequestSchema = z.object({
  type: z.literal('openRequest'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Openrequest = z.infer<typeof OpenrequestSchema>

// Openresponse
export const OpenresponseSchema = z.object({
  type: z.literal('openResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Openresponse = z.infer<typeof OpenresponseSchema>

// Privatechanneladdeventlistenerrequest
export const PrivatechanneladdeventlistenerrequestSchema = z.object({
  type: z.literal('privateChannelAddEventListenerRequest'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Privatechanneladdeventlistenerrequest = z.infer<typeof PrivatechanneladdeventlistenerrequestSchema>

// Privatechanneladdeventlistenerresponse
export const PrivatechanneladdeventlistenerresponseSchema = z.object({
  type: z.literal('privateChannelAddEventListenerResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Privatechanneladdeventlistenerresponse = z.infer<typeof PrivatechanneladdeventlistenerresponseSchema>

// Privatechanneldisconnectrequest
export const PrivatechanneldisconnectrequestSchema = z.object({
  type: z.literal('privateChannelDisconnectRequest'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Privatechanneldisconnectrequest = z.infer<typeof PrivatechanneldisconnectrequestSchema>

// Privatechanneldisconnectresponse
export const PrivatechanneldisconnectresponseSchema = z.object({
  type: z.literal('privateChannelDisconnectResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Privatechanneldisconnectresponse = z.infer<typeof PrivatechanneldisconnectresponseSchema>

// Privatechannelonaddcontextlistenerevent
export const PrivatechannelonaddcontextlistenereventSchema = z.object({
  type: z.literal('privateChannelOnAddContextListenerEvent'),
  payload: z.unknown().optional(),
  meta: z.object({
    eventUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Privatechannelonaddcontextlistenerevent = z.infer<typeof PrivatechannelonaddcontextlistenereventSchema>

// Privatechannelondisconnectevent
export const PrivatechannelondisconnecteventSchema = z.object({
  type: z.literal('privateChannelOnDisconnectEvent'),
  payload: z.unknown().optional(),
  meta: z.object({
    eventUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Privatechannelondisconnectevent = z.infer<typeof PrivatechannelondisconnecteventSchema>

// Privatechannelonunsubscribeevent
export const PrivatechannelonunsubscribeeventSchema = z.object({
  type: z.literal('privateChannelOnUnsubscribeEvent'),
  payload: z.unknown().optional(),
  meta: z.object({
    eventUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Privatechannelonunsubscribeevent = z.infer<typeof PrivatechannelonunsubscribeeventSchema>

// Privatechannelunsubscribeeventlistenerrequest
export const PrivatechannelunsubscribeeventlistenerrequestSchema = z.object({
  type: z.literal('privateChannelUnsubscribeEventListenerRequest'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Privatechannelunsubscribeeventlistenerrequest = z.infer<typeof PrivatechannelunsubscribeeventlistenerrequestSchema>

// Privatechannelunsubscribeeventlistenerresponse
export const PrivatechannelunsubscribeeventlistenerresponseSchema = z.object({
  type: z.literal('privateChannelUnsubscribeEventListenerResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Privatechannelunsubscribeeventlistenerresponse = z.infer<typeof PrivatechannelunsubscribeeventlistenerresponseSchema>

// Raiseintentforcontextrequest
export const RaiseintentforcontextrequestSchema = z.object({
  type: z.literal('raiseIntentForContextRequest'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Raiseintentforcontextrequest = z.infer<typeof RaiseintentforcontextrequestSchema>

// Raiseintentforcontextresponse
export const RaiseintentforcontextresponseSchema = z.object({
  type: z.literal('raiseIntentForContextResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Raiseintentforcontextresponse = z.infer<typeof RaiseintentforcontextresponseSchema>

// Raiseintentrequest
export const RaiseintentrequestSchema = z.object({
  type: z.literal('raiseIntentRequest'),
  payload: z.object({
        intent: z.string(),
        context: ContextSchema,
        app: z.string().optional()
      }),
  meta: z.object({
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Raiseintentrequest = z.infer<typeof RaiseintentrequestSchema>

// Raiseintentresponse
export const RaiseintentresponseSchema = z.object({
  type: z.literal('raiseIntentResponse'),
  payload: z.union([
        z.object({
          intentResult: z.unknown().optional(),
          source: z.string().optional()
        }), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Raiseintentresponse = z.infer<typeof RaiseintentresponseSchema>

// Raiseintentresultresponse
export const RaiseintentresultresponseSchema = z.object({
  type: z.literal('raiseIntentResultResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Raiseintentresultresponse = z.infer<typeof RaiseintentresultresponseSchema>

// Wcp1hello (generic)
export const Wcp1helloSchema = z.object({
  type: z.literal('WCP1Hello'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date()
  })
})

export type Wcp1hello = z.infer<typeof Wcp1helloSchema>

// Wcp2loadurl (generic)
export const Wcp2loadurlSchema = z.object({
  type: z.literal('WCP2LoadUrl'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date()
  })
})

export type Wcp2loadurl = z.infer<typeof Wcp2loadurlSchema>

// Wcp3handshake (generic)
export const Wcp3handshakeSchema = z.object({
  type: z.literal('WCP3Handshake'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date()
  })
})

export type Wcp3handshake = z.infer<typeof Wcp3handshakeSchema>

// Wcp4validateappidentity (generic)
export const Wcp4validateappidentitySchema = z.object({
  type: z.literal('WCP4ValidateAppIdentity'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date()
  })
})

export type Wcp4validateappidentity = z.infer<typeof Wcp4validateappidentitySchema>

// Wcp5validateappidentityfailedresponse
export const Wcp5validateappidentityfailedresponseSchema = z.object({
  type: z.literal('WCP5ValidateAppIdentityFailedResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Wcp5validateappidentityfailedresponse = z.infer<typeof Wcp5validateappidentityfailedresponseSchema>

// Wcp5validateappidentityresponse
export const Wcp5validateappidentityresponseSchema = z.object({
  type: z.literal('WCP5ValidateAppIdentityResponse'),
  payload: z.union([
        z.object({}), // Success
        z.object({ error: z.string() }) // Error
      ]),
  meta: z.object({
    responseUuid: z.string(),
    requestUuid: z.string(),
    timestamp: z.coerce.date()
  })
})

export type Wcp5validateappidentityresponse = z.infer<typeof Wcp5validateappidentityresponseSchema>

// Wcp6goodbye (generic)
export const Wcp6goodbyeSchema = z.object({
  type: z.literal('WCP6Goodbye'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date()
  })
})

export type Wcp6goodbye = z.infer<typeof Wcp6goodbyeSchema>

// Wcpconnectionstep (generic)
export const WcpconnectionstepSchema = z.object({
  type: z.literal('WCPConnectionStep'),
  payload: z.unknown().optional(),
  meta: z.object({
    requestUuid: z.string().optional(),
    responseUuid: z.string().optional(),
    eventUuid: z.string().optional(),
    timestamp: z.coerce.date()
  })
})

export type Wcpconnectionstep = z.infer<typeof WcpconnectionstepSchema>

// Union of all DACP message schemas
export const DACPMessageSchema = z.union([
  AddcontextlistenerrequestSchema,
  AddcontextlistenerresponseSchema,
  AddeventlistenerrequestSchema,
  AddeventlistenerresponseSchema,
  AddintentlistenerrequestSchema,
  AddintentlistenerresponseSchema,
  AgenteventSchema,
  AgentresponseSchema,
  ApiSchema,
  ApprequestSchema,
  BroadcasteventSchema,
  BroadcastrequestSchema,
  BroadcastresponseSchema,
  ChannelchangedeventSchema,
  CommonSchema,
  ContextlistenerunsubscriberequestSchema,
  ContextlistenerunsubscriberesponseSchema,
  CreateprivatechannelrequestSchema,
  CreateprivatechannelresponseSchema,
  EventlistenerunsubscriberequestSchema,
  EventlistenerunsubscriberesponseSchema,
  Fdc3userinterfacechannelsSchema,
  Fdc3userinterfacechannelselectedSchema,
  Fdc3userinterfacedragSchema,
  Fdc3userinterfacehandshakeSchema,
  Fdc3userinterfacehelloSchema,
  Fdc3userinterfacemessageSchema,
  Fdc3userinterfaceresolveSchema,
  Fdc3userinterfaceresolveactionSchema,
  Fdc3userinterfacerestyleSchema,
  FindinstancesrequestSchema,
  FindinstancesresponseSchema,
  FindintentrequestSchema,
  FindintentresponseSchema,
  FindintentsbycontextrequestSchema,
  FindintentsbycontextresponseSchema,
  GetappmetadatarequestSchema,
  GetappmetadataresponseSchema,
  GetcurrentchannelrequestSchema,
  GetcurrentchannelresponseSchema,
  GetcurrentcontextrequestSchema,
  GetcurrentcontextresponseSchema,
  GetinforequestSchema,
  GetinforesponseSchema,
  GetorcreatechannelrequestSchema,
  GetorcreatechannelresponseSchema,
  GetuserchannelsrequestSchema,
  GetuserchannelsresponseSchema,
  HeartbeatacknowledgmentrequestSchema,
  HeartbeateventSchema,
  IntenteventSchema,
  IntentlistenerunsubscriberequestSchema,
  IntentlistenerunsubscriberesponseSchema,
  IntentresultrequestSchema,
  IntentresultresponseSchema,
  JoinuserchannelrequestSchema,
  JoinuserchannelresponseSchema,
  LeavecurrentchannelrequestSchema,
  LeavecurrentchannelresponseSchema,
  OpenrequestSchema,
  OpenresponseSchema,
  PrivatechanneladdeventlistenerrequestSchema,
  PrivatechanneladdeventlistenerresponseSchema,
  PrivatechanneldisconnectrequestSchema,
  PrivatechanneldisconnectresponseSchema,
  PrivatechannelonaddcontextlistenereventSchema,
  PrivatechannelondisconnecteventSchema,
  PrivatechannelonunsubscribeeventSchema,
  PrivatechannelunsubscribeeventlistenerrequestSchema,
  PrivatechannelunsubscribeeventlistenerresponseSchema,
  RaiseintentforcontextrequestSchema,
  RaiseintentforcontextresponseSchema,
  RaiseintentrequestSchema,
  RaiseintentresponseSchema,
  RaiseintentresultresponseSchema,
  Wcp1helloSchema,
  Wcp2loadurlSchema,
  Wcp3handshakeSchema,
  Wcp4validateappidentitySchema,
  Wcp5validateappidentityfailedresponseSchema,
  Wcp5validateappidentityresponseSchema,
  Wcp6goodbyeSchema,
  WcpconnectionstepSchema
])

export type DACPMessage = z.infer<typeof DACPMessageSchema>


