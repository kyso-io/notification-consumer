import { UserNotificationsSettings } from '@kyso-io/kyso-model'
import { Inject, Injectable } from '@nestjs/common'
import { Db } from 'mongodb'
import { Constants } from '../constants'

@Injectable()
export class UtilsService {
    constructor(
        @Inject(Constants.DATABASE_CONNECTION)
        private db: Db,
    ) {}

    public async canUserReceiveNotification(user_id: string, key: string, organization_id?: string, channel_id?: string): Promise<boolean> {
        const uns: UserNotificationsSettings = await this.db.collection<UserNotificationsSettings>(Constants.DATABASE_COLLECTION_USER_NOTIFICATIONS_SETTINGS).findOne({ user_id })
        if (!uns) {
            return false
        }
        if (organization_id && channel_id) {
            return this.isEventEnabledInChannel(uns, organization_id, channel_id, key)
        } else if (organization_id) {
            return this.isEventEnabledInOrganization(uns, organization_id, key)
        } else {
            return this.isEventEnabledGlobally(uns, key)
        }
    }

    private isEventEnabledInChannel(uns: UserNotificationsSettings, organization_id: string, team_id: string, key: string): boolean {
        if (uns.channels_settings.hasOwnProperty(organization_id)) {
            if (uns.channels_settings[organization_id].hasOwnProperty(team_id)) {
                if (uns.channels_settings[organization_id][team_id].hasOwnProperty(key)) {
                    return uns.channels_settings[organization_id][team_id][key]
                } else {
                    return false
                }
            }
        }
        return this.isEventEnabledInOrganization(uns, organization_id, key)
    }

    private isEventEnabledInOrganization(uns: UserNotificationsSettings, organization_id: string, key: string): boolean {
        if (uns.organization_settings.hasOwnProperty(organization_id)) {
            if (uns.organization_settings[organization_id].hasOwnProperty(key)) {
                return uns.organization_settings[organization_id][key]
            } else {
                return false
            }
        }
        return this.isEventEnabledGlobally(uns, key)
    }

    private isEventEnabledGlobally(uns: UserNotificationsSettings, key: string): boolean {
        if (uns.global_settings.hasOwnProperty(key)) {
            return uns.global_settings[key]
        }
        return false
    }

    public sleep(milliseconds: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, milliseconds))
    }
}
