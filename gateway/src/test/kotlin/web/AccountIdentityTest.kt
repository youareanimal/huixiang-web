package web

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import tsproto.Identity
import tsproto.MyTsAccount
import tsproto.MyTsIdentities

class AccountIdentityTest {
    @Test fun automaticallyUsesOnlyTheSingleIdentityOfTheCurrentAccount() {
        val current = MyTsAccount.Session("synthetic-a", "A")
        val other = MyTsAccount.Session("synthetic-b", "B")
        fun entry(id: String): MyTsIdentities.Entry {
            val key = Identity.generate(securityLevel = 0)
            return MyTsIdentities.Entry(id, "fixture", "", key.uid, "fixture-uid", key)
        }
        val first = entry("1")
        assertEquals(first.identity.uid, automaticAccountIdentity(current, current, listOf(first))?.uid)
        assertNull(automaticAccountIdentity(current, other, listOf(first)))
        assertNull(automaticAccountIdentity(null, current, listOf(first)))
        assertNull(automaticAccountIdentity(current, current, emptyList()))
        assertNull(automaticAccountIdentity(current, current, listOf(first, entry("2"))))
    }
}
