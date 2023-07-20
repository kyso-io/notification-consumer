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

    public static getDisplayTextByChannelRoleName(role: string): string {
        if (!role) {
            return ''
        }

        switch (role.toLowerCase()) {
            case 'team-admin':
                return `Can administer this channel's settings.`
            case 'team-contributor':
                return `Can create content within this channel.`
            case 'team-reader':
                return 'Can read, create comments & tasks on reports in this channel.'
            default:
                return ''
        }
    }

    public static getDisplayTextByOrganizationRoleName(role: string): string {
        if (!role) {
            return ''
        }

        switch (role.toLowerCase()) {
            case 'organization-admin':
                return 'Full control of everything in the organization.'
            case 'team-admin':
                return `Can administer all channels within this organization.`
            case 'team-contributor':
                return `Can create content within this organization.`
            case 'team-reader':
                return 'Can read, create comments & tasks on reports in this organization.'
            default:
                return ''
        }
    }

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
